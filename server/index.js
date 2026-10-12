import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { configureAuth, requireAuth, requireRole } from './auth.js'

const app = express()
const port = Number(process.env.PORT || 8787)
const here = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(here, '../dist')
const allowedOrigin = process.env.CORS_ORIGIN
const rateWindowMs = 60_000
const maxRequests = Number(process.env.AI_RATE_LIMIT_PER_MINUTE || 20)
const requestBuckets = new Map()

app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))

app.use('/api', (req, res, next) => {
  const origin = req.headers.origin
  if (allowedOrigin && origin && origin !== allowedOrigin) {
    return res.status(403).json({ error: 'This origin is not allowed.' })
  }
  if (origin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin || origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(204)

  const key = req.ip || 'unknown'
  const now = Date.now()
  const current = requestBuckets.get(key)
  if (!current || now - current.start >= rateWindowMs) {
    requestBuckets.set(key, { start: now, count: 1 })
  } else {
    current.count += 1
    if (current.count > maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' })
    }
  }
  next()
})

const auth = configureAuth(app)

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ireme-education-agent',
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    authConfigured: auth.configured,
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/teacher/overview', requireRole('teacher', 'school_admin', 'platform_admin'), (_req, res) => {
  res.json({ portal: 'teacher', message: 'Teacher access verified. Classroom tools are the next implementation step.' })
})

app.get('/api/admin/overview', requireRole('school_admin', 'platform_admin'), (_req, res) => {
  res.json({ portal: 'admin', message: 'Administrator access verified. School management tools are the next implementation step.' })
})


const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

app.get('/api/conversations', requireAuth, async (req, res) => {
  const pool = req.app.locals.authPool
  if (!pool) return res.status(503).json({ error: 'Account services are not configured.' })
  try {
    const result = await pool.query('SELECT c.id, c.title, c.language, c.created_at, c.updated_at, (SELECT count(*)::int FROM conversation_messages m WHERE m.conversation_id = c.id) AS message_count FROM conversations c WHERE c.user_id = $1 ORDER BY c.updated_at DESC LIMIT 50', [req.session.userId])
    return res.json({ conversations: result.rows })
  } catch (error) {
    console.error('Conversation list failed:', error?.message || 'unknown error')
    return res.status(500).json({ error: 'Could not load your conversations.' })
  }
})

app.get('/api/conversations/:id/messages', requireAuth, async (req, res) => {
  if (!uuidPattern.test(req.params.id)) return res.status(400).json({ error: 'Conversation ID is invalid.' })
  const pool = req.app.locals.authPool
  if (!pool) return res.status(503).json({ error: 'Account services are not configured.' })
  try {
    const owned = await pool.query('SELECT id FROM conversations WHERE id = $1 AND user_id = $2 LIMIT 1', [req.params.id, req.session.userId])
    if (!owned.rowCount) return res.status(404).json({ error: 'Conversation not found.' })
    const result = await pool.query('SELECT id, role, content, created_at FROM conversation_messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 200', [req.params.id])
    return res.json({ messages: result.rows })
  } catch (error) {
    console.error('Conversation messages failed:', error?.message || 'unknown error')
    return res.status(500).json({ error: 'Could not load this conversation.' })
  }
})

app.get('/api/progress', requireAuth, async (req, res) => {
  const pool = req.app.locals.authPool
  if (!pool) return res.status(503).json({ error: 'Account services are not configured.' })
  try {
    const result = await pool.query('SELECT lp.id, lp.subject_id, s.name AS subject_name, s.name_rw AS subject_name_rw, lp.resource_id, r.title AS resource_title, lp.progress_percent, lp.completed_at, lp.last_activity_at, lp.updated_at FROM learning_progress lp LEFT JOIN subjects s ON s.id = lp.subject_id LEFT JOIN learning_resources r ON r.id = lp.resource_id WHERE lp.user_id = $1 ORDER BY lp.last_activity_at DESC LIMIT 200', [req.session.userId])
    return res.json({ progress: result.rows })
  } catch (error) {
    console.error('Learning progress lookup failed:', error?.message || 'unknown error')
    return res.status(500).json({ error: 'Could not load learning progress.' })
  }
})

app.put('/api/progress', requireAuth, async (req, res) => {
  const pool = req.app.locals.authPool
  if (!pool) return res.status(503).json({ error: 'Account services are not configured.' })
  const subjectId = typeof req.body?.subjectId === 'string' ? req.body.subjectId : null
  const resourceId = typeof req.body?.resourceId === 'string' ? req.body.resourceId : null
  const progressPercent = req.body?.progressPercent
  if (Boolean(subjectId) === Boolean(resourceId)) return res.status(400).json({ error: 'Provide exactly one subjectId or resourceId.' })
  if ((subjectId && !uuidPattern.test(subjectId)) || (resourceId && !uuidPattern.test(resourceId))) return res.status(400).json({ error: 'Subject or resource ID is invalid.' })
  if (!Number.isInteger(progressPercent) || progressPercent < 0 || progressPercent > 100) return res.status(400).json({ error: 'progressPercent must be an integer from 0 to 100.' })
  try {
    let result
    if (subjectId) {
      result = await pool.query('INSERT INTO learning_progress (user_id, subject_id, progress_percent, completed_at, last_activity_at, updated_at) SELECT $1, s.id, $3, CASE WHEN $3 = 100 THEN now() ELSE NULL END, now(), now() FROM subjects s WHERE s.id = $2 ON CONFLICT (user_id, subject_id) WHERE subject_id IS NOT NULL DO UPDATE SET progress_percent = EXCLUDED.progress_percent, completed_at = CASE WHEN EXCLUDED.progress_percent = 100 THEN COALESCE(learning_progress.completed_at, now()) ELSE NULL END, last_activity_at = now(), updated_at = now() RETURNING id, subject_id, resource_id, progress_percent, completed_at, last_activity_at, updated_at', [req.session.userId, subjectId, progressPercent])
    } else {
      result = await pool.query('INSERT INTO learning_progress (user_id, resource_id, progress_percent, completed_at, last_activity_at, updated_at) SELECT $1, r.id, $3, CASE WHEN $3 = 100 THEN now() ELSE NULL END, now(), now() FROM learning_resources r WHERE r.id = $2 ON CONFLICT (user_id, resource_id) DO UPDATE SET progress_percent = EXCLUDED.progress_percent, completed_at = CASE WHEN EXCLUDED.progress_percent = 100 THEN COALESCE(learning_progress.completed_at, now()) ELSE NULL END, last_activity_at = now(), updated_at = now() RETURNING id, subject_id, resource_id, progress_percent, completed_at, last_activity_at, updated_at', [req.session.userId, resourceId, progressPercent])
    }
    if (!result.rowCount) return res.status(404).json({ error: 'Subject or learning resource was not found.' })
    return res.json({ progress: result.rows[0] })
  } catch (error) {
    console.error('Learning progress save failed:', error?.message || 'unknown error')
    return res.status(500).json({ error: 'Could not save learning progress.' })
  }
})

app.post('/api/ask', async (req, res) => {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : ''
  const language = req.body?.language === 'rw' ? 'rw' : 'en'
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim().slice(0, 100) : ''
  const requestedConversationId = typeof req.body?.conversationId === 'string' ? req.body.conversationId : null
  if (requestedConversationId && !uuidPattern.test(requestedConversationId)) return res.status(400).json({ error: 'Conversation ID is invalid.' })
  const pool = req.app.locals.authPool
  let conversationId = null
  let history = []
  if (req.session?.userId && pool) {
    try {
      if (requestedConversationId) {
        const owned = await pool.query('SELECT id FROM conversations WHERE id = $1 AND user_id = $2 LIMIT 1', [requestedConversationId, req.session.userId])
        if (!owned.rowCount) return res.status(404).json({ error: 'Conversation not found.' })
        conversationId = requestedConversationId
        const prior = await pool.query('SELECT role, content FROM conversation_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 12', [conversationId])
        history = prior.rows.reverse().filter(row => row.role === 'user' || row.role === 'assistant')
      }
    } catch (error) {
      console.error('Conversation context load failed:', error?.message || 'unknown error')
      return res.status(500).json({ error: 'Could not load your conversation. Please try again.' })
    }
  }

  if (!question) return res.status(400).json({ error: 'Please enter a question.' })
  if (question.length > 4000) return res.status(413).json({ error: 'Questions must be 4,000 characters or fewer.' })
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: 'The AI service is not configured yet. Add OPENAI_API_KEY to the server environment.',
      code: 'AI_NOT_CONFIGURED',
    })
  }

  const languageName = language === 'rw' ? 'Kinyarwanda' : 'English'
  const systemPrompt = [
    'You are Ireme AI, a careful and encouraging educational tutor for learners in Rwanda.',
    'Respond in ' + languageName + '. Keep explanations age-appropriate, clear, and step-by-step.',
    'Teach concepts rather than merely giving homework answers. Ask a short guiding question when useful.',
    'Never invent official curriculum requirements, exam results, school records, or citations.',
    'If the user asks for official Rwanda curriculum or NESA-specific facts that are not provided in trusted context, say that the fact needs verification against an approved source.',
    'Do not claim to have accessed a school database, LMS, personal learning history, or external source unless it is actually provided in this request.',
    'For high-stakes student wellbeing or safeguarding concerns, respond supportively and recommend involving a trusted adult or qualified professional.',
    subject ? 'The learner selected this subject: ' + subject + '.' : '',
  ].filter(Boolean).join('\n')

  try {
    const response = await fetch(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.OPENAI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: question },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const providerMessage = typeof payload?.error?.message === 'string' ? payload.error.message : 'AI provider request failed.'
      console.error('AI provider returned status', response.status)
      return res.status(response.status === 429 ? 429 : 502).json({
        error: response.status === 401
          ? 'The server AI credentials were rejected. Check the configured API key.'
          : 'I could not get an answer right now. Please try again shortly.',
        code: 'AI_PROVIDER_ERROR',
        detail: process.env.NODE_ENV === 'development' ? providerMessage : undefined,
      })
    }

    const answer = payload?.choices?.[0]?.message?.content
    if (typeof answer !== 'string' || !answer.trim()) {
      return res.status(502).json({ error: 'The AI provider returned an empty answer. Please try again.' })
    }

    if (req.session?.userId && pool) {
      try {
        if (!conversationId) {
          const title = question.length > 100 ? question.slice(0, 97) + '...' : question
          const created = await pool.query('INSERT INTO conversations (user_id, title, language) VALUES ($1, $2, $3) RETURNING id', [req.session.userId, title, language])
          conversationId = created.rows[0].id
        }
        await pool.query("INSERT INTO conversation_messages (conversation_id, role, content) VALUES ($1, 'user', $2), ($1, 'assistant', $3)", [conversationId, question, answer.trim()])
        await pool.query('UPDATE conversations SET updated_at = now(), language = $2 WHERE id = $1', [conversationId, language])
      } catch (error) {
        console.error('Conversation persistence failed:', error?.message || 'unknown error')
        return res.status(503).json({ error: 'The answer was generated, but it could not be saved to your account.', code: 'CONVERSATION_SAVE_FAILED', answer: answer.trim() })
      }
    }
    return res.json({ answer: answer.trim(), language, subject: subject || null, conversationId })
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    console.error('AI request failed:', timedOut ? 'timeout' : error?.message || 'unknown error')
    return res.status(502).json({
      error: timedOut ? 'The AI took too long to respond. Please try again.' : 'The AI service is temporarily unavailable.',
      code: timedOut ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE',
    })
  }
})

app.use(express.static(distDir))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  return res.sendFile(path.join(distDir, 'index.html'), error => {
    if (error) next(error)
  })
})

app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' })
  if (error instanceof SyntaxError) return res.status(400).json({ error: 'Request JSON is invalid.' })
  console.error('Unhandled server error:', error?.message || 'unknown error')
  return res.status(500).json({ error: 'An unexpected server error occurred.' })
})

export default app

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log('Ireme AI server listening on port ' + port)
  })
}
