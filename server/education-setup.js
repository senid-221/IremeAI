import pg from 'pg'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { timingSafeEqual } from 'node:crypto'

const { Pool } = pg
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationFiles = [
  'db/migrations/001_initial_schema.sql',
  'db/migrations/002_learning_persistence_indexes.sql',
  'db/migrations/003_student_library_and_schedule.sql',
  'db/migrations/004_education_knowledge_base.sql',
]
let job = { state: 'idle', startedAt: null, finishedAt: null, logs: [], error: null }

function authorized(req) {
  const expected = process.env.EDUCATION_SETUP_TOKEN || ''
  const supplied = typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : ''
  if (expected.length < 32 || supplied.length !== expected.length) return false
  try { return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)) } catch { return false }
}
function log(message) {
  job.logs.push(String(message).slice(0, 500))
  if (job.logs.length > 80) job.logs.shift()
}
function safeError(error) {
  return String(error?.message || error || 'Unknown error')
    .replace(process.env.DATABASE_URL || '\u0000', '[database connection]')
    .replace(process.env.EDUCATION_SETUP_TOKEN || '\u0000', '[secret]')
    .slice(0, 500)
}

async function applyMigrations() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured in Hostinger.')
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'disable' ? false : process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: false } : undefined,
    max: 2,
    connectionTimeoutMillis: 10000,
  })
  try {
    await pool.query('SELECT 1')
    const existing = await pool.query("SELECT to_regclass('public.users') AS users_table")
    for (const file of migrationFiles) {
      if (file.includes('001_initial_schema.sql') && existing.rows[0].users_table) {
        log('001: skipped (core users table already exists; avoiding non-idempotent schema recreation).')
        continue
      }
      const sql = await readFile(path.join(root, file), 'utf8')
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('COMMIT')
        log(file + ': applied successfully.')
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw new Error(file + ': ' + safeError(error))
      } finally {
        client.release()
      }
    }
    const verify = await pool.query(`
      SELECT
        to_regclass('public.users') IS NOT NULL AS users_ready,
        to_regclass('public.education_documents') IS NOT NULL AS documents_ready,
        to_regclass('public.education_document_chunks') IS NOT NULL AS chunks_ready,
        to_regclass('public.subjects') IS NOT NULL AS subjects_ready
    `)
    if (!Object.values(verify.rows[0]).every(Boolean)) throw new Error('Database verification failed: required education tables are missing.')
    log('Database verification passed: users, subjects and education knowledge-base tables exist.')
  } finally {
    await pool.end()
  }
}

function runIngestion() {
  return new Promise((resolve, reject) => {
    log('Starting official REB/NESA/RTB HTML and text-PDF ingestion (safety limits apply).')
    const child = spawn(process.execPath, [path.join(root, 'scripts/ingest-education.js')], {
      cwd: root,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    const capture = (chunk) => {
      const value = chunk.toString()
      output = (output + value).slice(-12000)
      for (const line of value.split(/\r?\n/).filter(Boolean)) log(line)
    }
    child.stdout.on('data', capture)
    child.stderr.on('data', capture)
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('Education ingestion exceeded the 10-minute safety limit. Rerun with lower EDU_INGEST_MAX_PAGES / EDU_INGEST_MAX_CHARS or review hosting limits.'))
    }, 10 * 60 * 1000)
    child.on('error', error => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on('close', code => {
      clearTimeout(timeout)
      if (code === 0) resolve()
      else reject(new Error('Education ingestion exited with code ' + code + '. ' + output.slice(-1200)))
    })
  })
}

export function educationSetupPage(_req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'")
  res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ireme AI Education Setup</title><style>body{font:16px system-ui;max-width:720px;margin:32px auto;padding:0 16px;color:#17202a}input,button{font:inherit;padding:12px;width:100%;box-sizing:border-box;margin:8px 0;border-radius:8px}button{cursor:pointer;background:#182a4d;color:white;border:0}pre{white-space:pre-wrap;background:#f3f5f8;padding:12px;border-radius:8px;overflow-wrap:anywhere}.hint{color:#555;font-size:14px}</style></head><body><h1>Ireme AI Education Setup</h1><p>This private tool applies database migrations 001–004 and indexes accessible official REB, NESA and RTB HTML/text-based PDFs. It does not guarantee complete curriculum coverage.</p><label for="secret">Education setup secret (from Hostinger environment variables)</label><input id="secret" type="password" autocomplete="off" minlength="32" placeholder="Paste the secret you configured in hPanel"><button id="start">Apply migrations and start ingestion</button><button id="refresh" type="button">Refresh status</button><p class="hint">Use only over HTTPS. Never share this secret. Keep this page private.</p><pre id="status">Waiting for you to start.</pre><script>
const secret=document.getElementById('secret'),out=document.getElementById('status'),start=document.getElementById('start'),refresh=document.getElementById('refresh');let timer=null;
async function request(path,method='GET'){const r=await fetch(path,{method,headers:{Authorization:'Bearer '+secret.value,...(method==='POST'?{'Content-Type':'application/json'}:{})},body:method==='POST'?'{}':undefined,cache:'no-store'});const d=await r.json().catch(()=>({error:'Server returned a non-JSON response.'}));if(!r.ok)throw new Error(d.error||'Request failed ('+r.status+')');return d}
async function status(){try{const d=await request('/api/maintenance/education-setup/status');out.textContent=JSON.stringify(d,null,2);if(d.state==='running'){if(!timer)timer=setInterval(status,10000)}else if(timer){clearInterval(timer);timer=null}}catch(e){out.textContent=e.message}}
start.onclick=async()=>{if(secret.value.length<32){out.textContent='Enter the setup secret (at least 32 characters).';return}start.disabled=true;try{const d=await request('/api/maintenance/education-setup','POST');out.textContent=JSON.stringify(d,null,2);await status()}catch(e){out.textContent=e.message}finally{start.disabled=false}};
refresh.onclick=status;
</script></body></html>`)
}

export function educationSetupStatus(req, res) {
  if (!authorized(req)) return res.status(401).json({ error: 'Invalid setup secret.' })
  return res.json({ ...job, logs: job.logs.slice(-40) })
}

export async function startEducationSetup(req, res) {
  if (!authorized(req)) return res.status(401).json({ error: 'Invalid setup secret.' })
  if (job.state === 'running') return res.status(202).json({ message: 'Education setup is already running.', ...job })
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'DATABASE_URL is not configured in Hostinger.' })
  job = { state: 'running', startedAt: new Date().toISOString(), finishedAt: null, logs: [], error: null }
  res.status(202).json({ message: 'Setup started. Keep this page open and refresh status.', ...job })
  setImmediate(async () => {
    try {
      await applyMigrations()
      await runIngestion()
      job.state = 'completed'
      log('Setup completed. Review the indexed content before assuming curriculum coverage is complete.')
    } catch (error) {
      job.state = 'failed'
      job.error = safeError(error)
      log('Setup failed: ' + job.error)
    } finally {
      job.finishedAt = new Date().toISOString()
    }
  })
}
