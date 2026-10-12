#!/usr/bin/env node
import 'dotenv/config'
import pg from 'pg'
import pdfParse from 'pdf-parse'

const { Pool } = pg
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required. Configure it in the server environment.')
  process.exit(1)
}

const MAX_PAGES = Math.min(Math.max(Number(process.env.EDU_INGEST_MAX_PAGES || 40), 1), 200)
const MAX_CHARS = Math.min(Math.max(Number(process.env.EDU_INGEST_MAX_CHARS || 1500000), 10000), 5000000)
const TIMEOUT_MS = 25000
const INDEXER_BUILD = '2026-10-12-retry-3'
const USER_AGENT = 'IremeAI-EducationIndexer/1.0 (official education resource indexing; contact site administrator)'
const sources = [
  { publisher: 'Rwanda Basic Education Board', title: 'REB Curriculum, Teaching and Learning Resources', url: 'https://www.reb.gov.rw/curriculum-teaching-learning-resources-department', level: 'Nursery, Primary P1-P6, Secondary S1-S6', type: 'curriculum' },
  { publisher: 'Rwanda Basic Education Board', title: 'REB E-Learning', url: 'https://elearning.reb.rw/', level: 'Primary P1-P6, Secondary S1-S6', type: 'textbook' },
  { publisher: 'Rwanda Basic Education Board', title: 'REB Publications', url: 'https://www.reb.gov.rw/publications', level: 'Basic education', type: 'teacher_guide' },
  { publisher: 'National Examination and School Inspection Authority', title: 'NESA Official Resources', url: 'https://www.nesa.gov.rw/1/resources', level: 'Primary, Secondary', type: 'assessment' },
  { publisher: 'Rwanda TVET Board', title: 'RTB Curriculum and Instructional Materials', url: 'https://www.rtb.gov.rw/curriculum-instructional-materials-development-department', level: 'TVET Levels 1-5', type: 'tvet_module' },
  { publisher: 'Rwanda TVET Board', title: 'RTB TVET Curricula Portal', url: 'https://tvetmanagement.rtb.gov.rw/curricula', level: 'TVET Levels 1-5', type: 'tvet_module' },
  { publisher: 'Rwanda TVET Board', title: 'RTB E-Learning', url: 'https://www.elearning.rtb.gov.rw/course/index.php?categoryid=4', level: 'TVET Levels 1-5', type: 'tvet_module' },
  { publisher: 'Rwanda TVET Board', title: 'RTB Publications', url: 'https://www.rtb.gov.rw/publications', level: 'TVET', type: 'teacher_guide' },
]
const allowedOfficialRoots = ['reb.gov.rw', 'reb.rw', 'nesa.gov.rw', 'rtb.gov.rw']
const allowedOfficialHosts = new Set(['elearning.reb.rw', 'elearning.rtb.gov.rw', 'www.elearning.rtb.gov.rw', 'curricula.rtb.gov.rw', 'nrs.gov.rw'])
function isAllowedOfficialHost(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return allowedOfficialHosts.has(host) || allowedOfficialRoots.some(root => host === root || host.endsWith('.' + root))
}
const pool = new Pool({ connectionString: DATABASE_URL, ssl: process.env.DATABASE_SSL === 'disable' ? false : process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined, max: 3, connectionTimeoutMillis: 10000 })
const seen = new Set()
let totalChars = 0
let pages = 0
let stored = 0
let skipped = 0

function safeUrl(raw, base) {
  try {
    const u = new URL(raw, base)
    if (u.protocol !== 'https:' || !isAllowedOfficialHost(u.hostname) || u.username || u.password) return null
    u.hash = ''
    const lastSegment = u.pathname.split('/').pop() || ''
    const extension = lastSegment.includes('.') ? lastSegment.split('.').pop().toLowerCase() : ''
    if (!['html', 'htm', 'php', 'pdf', ''].includes(extension)) return null
    return u.href
  } catch { return null }
}
function cleanHtml(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n) || 32))
    .replace(/[ \t\f\v]+/g, ' ').replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n').trim()
}
function extractTitle(html, fallback) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? cleanHtml(match[1]).slice(0, 240) : fallback
}
function splitChunks(text, size = 3500) {
  const chunks = []
  let rest = text
  while (rest.length) {
    let end = Math.min(size, rest.length)
    if (end < rest.length) {
      const boundary = rest.lastIndexOf('\n', end)
      if (boundary > size * 0.55) end = boundary
    }
    const part = rest.slice(0, end).trim()
    if (part.length >= 100) chunks.push(part)
    rest = rest.slice(end).trimStart()
  }
  return chunks
}
async function fetchPage(url) {
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' }, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' })
  if (!response.ok) throw new Error('HTTP ' + response.status)
  const finalUrl = safeUrl(response.url, url)
  if (!finalUrl) {
    let redirectHost = 'unknown'
    try { redirectHost = new URL(response.url).hostname } catch {}
    throw new Error('Redirected to a host outside the official allowlist: ' + redirectHost)
  }
  const type = response.headers.get('content-type') || ''
  if (type.includes('application/pdf') || finalUrl.toLowerCase().split('?')[0].endsWith('.pdf')) {
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > 25 * 1024 * 1024) throw new Error('PDF exceeds 25 MB safety limit')
    const parsed = await pdfParse(buffer)
    const text = String(parsed.text || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 150000)
    return { url: finalUrl, title: String(parsed.info?.Title || finalUrl.split('/').pop() || 'Official PDF').slice(0, 240), text, links: [], language: 'en' }
  }
  if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) throw new Error('Unsupported resource type: ' + type)
  const html = await response.text()
  const text = cleanHtml(html).slice(0, 60000)
  const links = [...html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)].map(m => safeUrl(m[1], finalUrl)).filter(Boolean)
  return { url: finalUrl, title: extractTitle(html, finalUrl), text, links, language: 'en' }
}
function inferMetadata(source, page) {
  const label = (page.title + ' ' + page.url.split('/').pop()).replace(/[_-]+/g, ' ').toUpperCase()
  const grade = label.match(/\b(P[1-6]|S[1-6]|N[1-3])\b/)
  const tvet = label.match(/\b(?:TVET\s*)?(?:LEVEL|L)\s*([1-5])\b/)
  const subjects = [
    ['Mathematics', /\b(MATHEMATICS|MATHS?)\b/], ['Kinyarwanda', /\bKINYARWANDA\b/], ['English', /\bENGLISH\b/],
    ['French', /\bFRENCH\b/], ['Kiswahili', /\b(KISWAHILI|SWAHILI)\b/], ['Physics', /\bPHYSICS\b/],
    ['Chemistry', /\bCHEMISTRY\b/], ['Biology', /\bBIOLOGY\b/], ['Science and Technology', /\b(SCIENCE|SET)\b/],
    ['Social Studies', /\b(SOCIAL STUDIES|SST)\b/], ['Geography', /\bGEOGRAPHY\b/], ['History', /\bHISTORY\b/],
    ['Entrepreneurship', /\b(ENTREPRENEURSHIP|BUSINESS)\b/], ['ICT', /\b(ICT|INFORMATION TECHNOLOGY)\b/],
    ['Computer Science', /\b(COMPUTER SCIENCE|COMPUTING|CODING)\b/], ['Agriculture', /\b(AGRICULTURE|AGRIC)\b/],
    ['Fine Art', /\b(FINE ART|ART AND CRAFT|CREATIVE ARTS)\b/], ['Music', /\bMUSIC\b/],
  ]
  const subject = subjects.find(([, pattern]) => pattern.test(label))?.[0] || null
  return { level: grade?.[1] || (tvet ? 'TVET Level ' + tvet[1] : source.level), subject }
}
function inferTopic(chunk, fallbackTitle) {
  const lines = chunk.split(/\n+/).map(line => line.trim()).filter(line => line.length >= 4 && line.length <= 160)
  const heading = lines.find(line =>
    /^(unit|topic|lesson|chapter|module|competence|learning outcome|activity|week|section)\s*[:\-\d.]?/i.test(line) ||
    (/^[A-Z][A-Za-z0-9 ,:()'’&/-]{4,100}$/.test(line) && line.split(/\s+/).length <= 12)
  )
  return (heading || fallbackTitle || 'Learning content').slice(0, 160)
}

async function savePage(source, page) {
  if (page.text.length < 250) { skipped++; return }
  const metadata = inferMetadata(source, page)
  const doc = await pool.query(
    `INSERT INTO education_documents(title,publisher,document_type,education_level,subject_name,source_url,file_url,is_official,verification_status,language)
     VALUES($1,$2,$3,$4,$5,$6,$6,true,'verified','en')
     ON CONFLICT(publisher,title,source_url) DO UPDATE SET education_level=EXCLUDED.education_level,subject_name=EXCLUDED.subject_name,updated_at=now()
     RETURNING id`,
    [page.title || source.title, source.publisher, source.type, metadata.level, metadata.subject, page.url],
  )
  const documentId = doc.rows[0].id
  const chunks = splitChunks(page.text)
  for (let i = 0; i < chunks.length; i++) {
    const topic = inferTopic(chunks[i], page.title)
    await pool.query(
      `INSERT INTO education_document_chunks(document_id,chunk_index,heading,content,language,grade_level,subject_name)
       VALUES($1,$2,$3,$4,'en',$5,$6)
       ON CONFLICT(document_id,chunk_index) DO UPDATE SET heading=EXCLUDED.heading,content=EXCLUDED.content,grade_level=EXCLUDED.grade_level,subject_name=EXCLUDED.subject_name`,
      [documentId, i, topic, chunks[i], metadata.level, metadata.subject],
    )
  }
  stored += chunks.length
}
async function main() {
  const client = await pool.connect()
  client.release()
  console.log('INDEXER_BUILD:', INDEXER_BUILD)
  console.log('Ireme AI official-source HTML/PDF indexing started.')
  console.log('Limit:', MAX_PAGES, 'pages; maximum extracted text:', MAX_CHARS, 'characters.')
  try {
    for (const source of sources) {
      const queue = [source.url]
      let sourcePages = 0
      while (queue.length && pages < MAX_PAGES && totalChars < MAX_CHARS && sourcePages < 12) {
        const url = queue.shift()
        if (!url || seen.has(url)) continue
        seen.add(url)
        try {
          const page = await fetchPage(url)
          pages++
          sourcePages++
          totalChars += page.text.length
          await savePage(source, page)
          console.log('Indexed:', page.url, '(' + page.text.length + ' chars)')
          for (const link of page.links) {
            if (!seen.has(link) && queue.length < 100 && totalChars < MAX_CHARS) queue.push(link)
          }
        } catch (error) {
          console.warn('Skipped:', url, '-', error.message)
          skipped++
        }
      }
      if (pages >= MAX_PAGES || totalChars >= MAX_CHARS) break
    }
    console.log(JSON.stringify({ pagesVisited: pages, charactersExtracted: totalChars, chunksStored: stored, skipped, note: 'This imports accessible HTML and text-extractable PDFs from allowlisted official domains only. Scanned/image-only PDFs, login-protected resources and inaccessible files need OCR or manual review. Confirm extracted metadata and source accuracy; this does not guarantee complete curriculum coverage.' }, null, 2))
  } finally {
    await pool.end()
  }
}
main().catch(async error => {
  console.error('Education indexing failed:', error.message)
  await pool.end().catch(() => {})
  process.exitCode = 1
})
