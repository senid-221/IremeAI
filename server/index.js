import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ireme-education-agent',
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    timestamp: new Date().toISOString(),
  })
})

app.post('/api/ask', async (req, res) => {
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : ''
  const language = req.body?.language === 'rw' ? 'rw' : 'en'
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim().slice(0, 100) : ''

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

    return res.json({ answer: answer.trim(), language, subject: subject || null })
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
