#!/usr/bin/env node
import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required. Configure it in the server environment.')
  process.exit(1)
}

const MAX_PAGES = Math.min(Math.max(Number(process.env.EDU_INGEST_MAX_PAGES || 40), 1), 200)
const MAX_CHARS = Math.min(Math.max(Number(process.env.EDU_INGEST_MAX_CHARS || 1500000), 10000), 5000000)
const TIMEOUT_MS = 15000
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
const allowedHosts = new Set(['reb.gov.rw', 'www.reb.gov.rw', 'elearning.reb.rw', 'nesa.gov.rw', 'www.nesa.gov.rw', 'rtb.gov.rw', 'www.rtb.gov.rw', 'tvetmanagement.rtb.gov.rw', 'www.elearning.rtb.gov.rw', 'elearning.rtb.gov.rw', 'curricula.rtb.gov.rw'])
const pool = new Pool({ connectionString: DATABASE_URL, ssl: process.env.DATABASE_SSL === 'disable' ? false : process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined, max: 3, connectionTimeoutMillis: 10000 })
const seen = new Set()
let totalChars = 0
let pages = 0
let stored = 0
let skipped = 0

function safeUrl(raw, base) {
  try {
    const u = new URL(raw, base)
    if (u.protocol !== 'https:' || !allowedHosts.has(u.hostname) || u.username || u.password) return null
    u.hash = ''
    if (!['html', 'htm', 'php', ''].includes((u.pathname.split('.').pop() || '').toLowerCase()) && !u.pathname.endsWith('/')) return null
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
  if (!finalUrl) throw new Error('Redirected outside the official allowlist')
  const type = response.headers.get('content-type') || ''
  if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) throw new Error('Non-HTML resource; PDF/document extraction is not enabled in this importer')
  const html = await response.text()
  const text = cleanHtml(html).slice(0, 60000)
  const links = [...html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)].map(m => safeUrl(m[1], finalUrl)).filter(Boolean)
  return { url: finalUrl, title: extractTitle(html, finalUrl), text, links }
}
async function savePage(source, page) {
  if (page.text.length < 250) { skipped++; return }
  const doc = await pool.query(
    `INSERT INTO education_documents(title,publisher,document_type,education_level,source_url,file_url,is_official,verification_status,language)
     VALUES($1,$2,$3,$4,$5,$5,true,'verified','en')
     ON CONFLICT(publisher,title,source_url) DO UPDATE SET education_level=EXCLUDED.education_level,updated_at=now()
     RETURNING id`,
    [page.title || source.title, source.publisher, source.type, source.level, page.url],
  )
  const documentId = doc.rows[0].id
  const chunks = splitChunks(page.text)
  for (let i = 0; i < chunks.length; i++) {
    await pool.query(
      `INSERT INTO education_document_chunks(document_id,chunk_index,heading,content,language,grade_level)
       VALUES($1,$2,$3,$4,'en',$5)
       ON CONFLICT(document_id,chunk_index) DO UPDATE SET heading=EXCLUDED.heading,content=EXCLUDED.content,grade_level=EXCLUDED.grade_level`,
      [documentId, i, page.title, chunks[i], source.level],
    )
  }
  stored += chunks.length
}
async function main() {
  const client = await pool.connect()
  client.release()
  console.log('Ireme AI official-source HTML indexing started.')
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
    console.log(JSON.stringify({ pagesVisited: pages, charactersExtracted: totalChars, chunksStored: stored, skipped, note: 'This imports accessible official HTML pages only. PDFs, login-protected content, and inaccessible files need a separate lawful extraction/review workflow; this does not guarantee complete curriculum coverage.' }, null, 2))
  } finally {
    await pool.end()
  }
}
main().catch(async error => {
  console.error('Education indexing failed:', error.message)
  await pool.end().catch(() => {})
  process.exitCode = 1
})
