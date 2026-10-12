import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { configureAuth, requireAuth, requireRole } from './auth.js'
import { registerAssessmentRoutes } from './assessments.js'
import { officialEducationSources } from './education-catalog.js'
import { educationSetupPage, educationSetupStatus, startEducationSetup } from './education-setup.js'

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
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

// hPanel-only maintenance tool protected by a dedicated server-side secret.
app.get('/education-setup', educationSetupPage)
app.get('/api/maintenance/education-setup/status', educationSetupStatus)
app.post('/api/maintenance/education-setup', startEducationSetup)

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ireme-education-agent',
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    webResearchConfigured: Boolean(process.env.EXA_API_KEY),
    authConfigured: auth.configured,
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/education/sources', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.json({ sources: officialEducationSources })
})

app.get('/api/education/search', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 300) : ''
  const level = typeof req.query.level === 'string' ? req.query.level.trim().slice(0, 60) : ''
  const subject = typeof req.query.subject === 'string' ? req.query.subject.trim().slice(0, 100) : ''
  if (!query && !level && !subject) return res.status(400).json({ error: 'Provide q, level or subject to search.' })
  const pool = req.app.locals.authPool
  if (!pool) return res.status(503).json({ error: 'Education database is not configured. Apply database migrations.', code: 'EDUCATION_DB_NOT_CONFIGURED' })
  try {
    const result = await pool.query(
      `SELECT d.id AS document_id, d.title, d.publisher, d.document_type, d.education_level, d.subject_name, d.language, d.academic_year, d.source_url, d.file_url, c.heading, c.content, c.grade_level AS chunk_grade_level, c.subject_name AS chunk_subject, CASE WHEN $1 <> '' THEN ts_rank(c.search_vector, plainto_tsquery('simple', $1)) ELSE 0 END AS rank FROM education_documents d JOIN education_document_chunks c ON c.document_id = d.id WHERE d.verification_status = 'verified' AND ($1 = '' OR c.search_vector @@ plainto_tsquery('simple', $1) OR c.content ILIKE '%' || $1 || '%' OR coalesce(c.heading,'') ILIKE '%' || $1 || '%') AND ($2 = '' OR coalesce(d.education_level,'') ILIKE '%' || $2 || '%' OR coalesce(c.grade_level,'') ILIKE '%' || $2 || '%') AND ($3 = '' OR coalesce(d.subject_name,'') ILIKE '%' || $3 || '%' OR coalesce(c.subject_name,'') ILIKE '%' || $3 || '%') ORDER BY rank DESC, d.title ASC LIMIT 12`,
      [query, level, subject],
    )
    return res.json({ results: result.rows, count: result.rowCount, source: 'verified-postgresql-education-index' })
  } catch (error) {
    console.error('Education knowledge search failed:', error?.message || 'unknown error')
    return res.status(500).json({ error: 'Could not search the education knowledge base.' })
  }
})
app.get('/api/teacher/overview', requireRole('teacher', 'school_admin', 'platform_admin'), (_req, res) => {
  res.json({ portal: 'teacher', message: 'Teacher access verified. Classroom tools are the next implementation step.' })
})

app.get('/api/admin/overview', requireRole('school_admin', 'platform_admin'), (_req, res) => {
  res.json({ portal: 'admin', message: 'Administrator access verified. School management tools are the next implementation step.' })
})


const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
registerAssessmentRoutes(app, { requireAuth, requireRole, uuidPattern })


const studyResourceCatalog = {
  'algebra-essentials': { title: 'Algebra essentials', subject: 'Mathematics', resourceType: 'Study guide', duration: '12 min read' },
  'cell-structure-function': { title: 'Cell structure & function', subject: 'Biology', resourceType: 'Lesson notes', duration: '18 min read' },
  'essay-writing-framework': { title: 'Essay writing framework', subject: 'English language', resourceType: 'Writing guide', duration: '8 min read' },
  'practice-equations': { title: 'Practice questions: equations', subject: 'Mathematics', resourceType: 'Practice set', duration: '10 questions' },
}

app.get('/api/saved-resources', requireAuth, async (req, res) => {
  const pool = req.app.locals.authPool
  if (!pool) return res.status(503).json({ error: 'Account services are not configured.' })
  try {
    const result = await pool.query('SELECT resource_key, title, subject, resource_type, duration, created_at FROM user_saved_resources WHERE user_id = $1 ORDER BY created_at DESC', [req.session.userId])
    return res.json({ savedResources: result.rows })
  } catch (error) {
    console.error('Saved resources lookup failed:', error?.message || 'unknown error')
    return res.status(500).json({ error: 'Could not load saved resources.' })
  }
})

app.put('/api/saved-resources/:key', requireAuth, async (req, res) => {
  const resource = studyResourceCatalog[req.params.key]
  if (!resource) return res.status(404).json({ error: 'This study resource is not available.' })
  const pool = req.app.locals.authPool
  if (!pool) return res.status(503).json({ error: 'Account services are not configured.' })
  try {
    const result = await pool.query(
      'INSERT INTO user_saved_resources (user_id, resource_key, title, subject, resource_type, duration) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (user_id, resource_key) DO UPDATE SET title = EXCLUDED.title, subject = EXCLUDED.subject, resource_type = EXCLUDED.resource_type, duration = EXCLUDED.duration RETURNING resource_key, title, subject, resource_type, duration, created_at',
      [req.session.userId, req.params.key, resource.title, resource.subject, resource.resourceType, resource.duration],
    )
    return res.json({ savedResource: result.rows[0] })
  } catch (error) {
    console.error('Save resource failed:', error?.message || 'unknown error')
    return res.status(500).json({ error: 'Could not save this resource.' })
  }
})

app.delete('/api/saved-resources/:key', requireAuth, async (req, res) => {
  const pool = req.app.locals.authPool
  if (!pool) return res.status(503).json({ error: 'Account services are not configured.' })
  try {
    await pool.query('DELETE FROM user_saved_resources WHERE user_id = $1 AND resource_key = $2', [req.session.userId, req.params.key])
    return res.status(204).end()
  } catch (error) {
    console.error('Remove saved resource failed:', error?.message || 'unknown error')
    return res.status(500).json({ error: 'Could not remove this saved resource.' })
  }
})

app.get('/api/study-sessions', requireAuth, async (req, res) => {
  const pool = req.app.locals.authPool
  if (!pool) return res.status(503).json({ error: 'Account services are not configured.' })
  try {
    const result = await pool.query('SELECT id, title, scheduled_for, duration_minutes, status, created_at FROM user_study_sessions WHERE user_id = $1 ORDER BY COALESCE(scheduled_for, created_at) ASC LIMIT 100', [req.session.userId])
    return res.json({ sessions: result.rows })
  } catch (error) {
    console.error('Study sessions lookup failed:', error?.message || 'unknown error')
    return res.status(500).json({ error: 'Could not load your study schedule.' })
  }
})

app.post('/api/study-sessions', requireAuth, async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
  const scheduledFor = typeof req.body?.scheduledFor === 'string' && req.body.scheduledFor.trim() ? req.body.scheduledFor : null
  const durationMinutes = req.body?.durationMinutes === undefined ? 45 : req.body.durationMinutes
  if (title.length < 2 || title.length > 160) return res.status(400).json({ error: 'Session title must be between 2 and 160 characters.' })
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 360) return res.status(400).json({ error: 'Session duration must be between 5 and 360 minutes.' })
  if (scheduledFor && (Number.isNaN(Date.parse(scheduledFor)) || !/[zZ]|[+-]\d{2}:\d{2}$/.test(scheduledFor))) return res.status(400).json({ error: 'Provide a valid scheduledFor timestamp with timezone.' })
  const pool = req.app.locals.authPool
  if (!pool) return res.status(503).json({ error: 'Account services are not configured.' })
  try {
    const result = await pool.query(
      'INSERT INTO user_study_sessions (user_id, title, scheduled_for, duration_minutes) VALUES ($1, $2, $3, $4) RETURNING id, title, scheduled_for, duration_minutes, status, created_at',
      [req.session.userId, title, scheduledFor, durationMinutes],
    )
    return res.status(201).json({ session: result.rows[0] })
  } catch (error) {
    console.error('Study session create failed:', error?.message || 'unknown error')
    return res.status(500).json({ error: 'Could not create your study session.' })
  }
})

app.delete('/api/study-sessions/:id', requireAuth, async (req, res) => {
  if (!uuidPattern.test(req.params.id)) return res.status(400).json({ error: 'Study session ID is invalid.' })
  const pool = req.app.locals.authPool
  if (!pool) return res.status(503).json({ error: 'Account services are not configured.' })
  try {
    const result = await pool.query('DELETE FROM user_study_sessions WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId])
    if (!result.rowCount) return res.status(404).json({ error: 'Study session not found.' })
    return res.status(204).end()
  } catch (error) {
    console.error('Study session delete failed:', error?.message || 'unknown error')
    return res.status(500).json({ error: 'Could not remove this study session.' })
  }
})

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

  let educationContext = []
  if (pool) {
    try {
      // Keep retrieval queries compact and robust for English/Kinyarwanda questions.
      const terms = question.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []
      const uniqueTerms = [...new Set(terms)].slice(0, 12)
      const searchTerms = uniqueTerms.join(' ')
      if (searchTerms) {
        const knowledge = await pool.query(
          `SELECT d.title, d.publisher, d.document_type, d.education_level, d.subject_name, d.academic_year, d.source_url, c.heading, c.content,
             ts_rank(c.search_vector, plainto_tsquery('simple', $1)) AS rank
           FROM education_documents d
           JOIN education_document_chunks c ON c.document_id = d.id
           WHERE d.verification_status = 'verified'
             AND (
               c.search_vector @@ plainto_tsquery('simple', $1)
               OR EXISTS (
                 SELECT 1 FROM unnest($2::text[]) AS term
                 WHERE length(term) >= 4
                   AND (c.content ILIKE '%' || term || '%' OR coalesce(c.heading,'') ILIKE '%' || term || '%'
                     OR coalesce(d.title,'') ILIKE '%' || term || '%' OR coalesce(d.subject_name,'') ILIKE '%' || term || '%')
               )
             )
           ORDER BY rank DESC, length(c.content) DESC
           LIMIT 8`,
          [searchTerms, uniqueTerms],
        )
        educationContext = knowledge.rows
      }
    } catch (error) {
      console.error('Education retrieval unavailable; continuing without DB context:', error?.message || 'unknown error')
    }
  }
  // Live web research is optional; configure EXA_API_KEY on the server to enable it.
  let researchResults = []
  if (process.env.EXA_API_KEY) {
    try {
      const researchQuery = [question, subject ? 'Subject: ' + subject : '', 'Rwanda education REB NESA RTB official sources factual information'].filter(Boolean).join(' ')
      const researchResponse = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: { 'x-api-key': process.env.EXA_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: researchQuery, type: 'auto', numResults: 6, contents: { text: { maxCharacters: 1800 }, highlights: { numSentences: 3, highlightsPerUrl: 2 } } }),
        signal: AbortSignal.timeout(12_000),
      })
      if (!researchResponse.ok) {
        console.error('Live research provider returned status', researchResponse.status)
      } else {
        const researchPayload = await researchResponse.json().catch(() => ({}))
        researchResults = (Array.isArray(researchPayload.results) ? researchPayload.results : []).slice(0, 6).map(item => ({ title: typeof item.title === 'string' ? item.title.slice(0, 240) : 'Untitled source', url: typeof item.url === 'string' ? item.url.slice(0, 1000) : '', publishedDate: typeof item.publishedDate === 'string' ? item.publishedDate : null, text: typeof item.text === 'string' ? item.text.slice(0, 4500) : '', highlights: Array.isArray(item.highlights) ? item.highlights.filter(value => typeof value === 'string').slice(0, 3) : [] })).filter(item => item.url && (item.text || item.highlights.length))
      }
    } catch (error) {
      console.error('Live research unavailable; continuing with available context:', error?.message || 'unknown error')
    }
  }

  const languageName = language === 'rw' ? 'Kinyarwanda' : 'English'
  const systemPrompt = [
    'IDENTITY AND MISSION: You are Ireme AI, a reliable, patient, inclusive educational tutor designed for learners, teachers and families in Rwanda. Help people understand, practise and apply knowledge—not merely receive answers. Align school-level teaching with Rwanda’s Competence-Based Curriculum (CBC) where applicable. Recognize nursery, primary P1–P6, lower secondary S1–S3, upper secondary S4–S6, TTC, and TVET/TSS pathways, while acknowledging that programme structures and syllabi may change.',
    'CORE BEHAVIOUR: Answer the learner’s actual question directly before adding background. Do not begin with a fixed questionnaire. Do not demand class, subject, topic, school, district or school year when the request can already be answered. If context is missing, give the best safe, useful general answer and offer optional tailoring in one short sentence. Ask only one concise follow-up when a missing fact is essential to avoid a materially wrong answer. Never repeat a question the learner has already answered in the conversation.',
    'RWANDA CONTEXT: Use examples familiar and respectful in Rwanda, such as home and community life, the local environment, agriculture, markets, transport, health, technology and civic life, when they help explain a lesson. Do not assume every learner lives in a particular district, has internet access, owns a device or speaks English fluently. Explain unfamiliar terminology and offer low-cost or offline ways to practise where relevant.',
    'TEACHING METHOD: Explain from simple to complex. For a learning question, normally give a direct definition or answer, a step-by-step explanation, a worked or everyday example, and a short practice task or recap when useful. For mathematics and science, show the method, units and reasoning, not only the final result. For languages, model correct usage and give examples. For essays and projects, help plan, draft and improve while preserving the learner’s own work. Keep answers proportionate to the question; do not force a long lesson for a simple request.',
    'CBC AND LEVEL ADAPTATION: Where the class or qualification level is known, adapt vocabulary, depth, activities and expected competencies to that level. If it is unknown, start with a clear beginner-friendly explanation and do not block the answer. Distinguish learning objectives or competencies, knowledge, practical skills and attitudes where relevant. Do not invent official competency codes or claim exact syllabus alignment unless verified from a reliable source.',
    'TRUTH AND RESEARCH: Accuracy is more important than sounding confident. For factual or curriculum-sensitive questions, use available live research and verified database excerpts when present. Prefer current official REB, NESA, RTB and relevant Government of Rwanda sources; check dates and compare independent credible sources when possible. Clearly separate verified facts, your explanation, examples you created and anything uncertain. If sources are unavailable or conflict, say so briefly, do not fabricate a citation, and still provide a clearly labelled general explanation when useful. Never claim to have read a textbook, PDF, exam paper or school register unless its contents were actually retrieved.',
    'OFFICIAL MATERIALS AND EXAMS: Direct learners to lawful official resources for textbooks, teacher guides, curricula and past papers. Do not pretend generated practice exercises are official NESA questions or official marking schemes. Label original questions as Ireme AI practice. When explaining an official exam or timetable, cite the actual source and date if available; never guess exam dates, results or regulations. During an active test, support understanding and reasoning rather than helping the learner cheat.',
    'SAFE AND INCLUSIVE LEARNING: Be respectful, encouraging and patient. Never shame a learner for mistakes or weak reading skills. Break difficult material into smaller steps and correct errors kindly. Avoid unnecessary personal data requests. Do not fabricate student grades, school records, admissions decisions or official documents. When a topic involves urgent health, safety or serious wellbeing risks, give cautious supportive guidance and point to an appropriate trusted adult or qualified professional.',
    'LANGUAGE: Respond in ' + languageName + '. If asked, explain terms in both English and Kinyarwanda. Use correct, clear Kinyarwanda and age-appropriate language.',
    'NO-INTERROGATION RULE: Never require a learner to state class, subject, topic or school year before giving help. Answer the actual question first using available context. If the learner’s level is unknown, start with a clear, accessible explanation and offer to adapt it afterward. Ask no more than one concise follow-up question, and only if the missing detail is essential to correctness. Do not repeat questions already answered in the conversation or ask a list of setup questions.',
    'RWANDA EDUCATION AUTHORITIES: Use Rwanda Education Board (REB) as the primary authority for curriculum, syllabi, textbooks, teacher guides and learning resources for general education; use Rwanda TVET Board (RTB) for TVET programmes, occupational standards, modules and vocational curricula; use National Examination and School Inspection Authority (NESA) for national assessment, examination guidance, published timetables and official assessment information. Do not confuse their responsibilities or imply that one institution publishes every resource. Official starting points: https://www.reb.gov.rw/, https://elearning.reb.rw/, https://www.nesa.gov.rw/, https://www.rtb.gov.rw/, https://curricula.rtb.gov.rw/.',
    'RWANDA CURRICULUM TEACHING: When teaching school content, align with the relevant Rwanda CBC competence, subject and level only when verified or reasonably supported. Explain concepts, skills and real-life applications, not memorization alone. For lessons, use a helpful structure when appropriate: learning goal, simple explanation, worked example, Rwanda-relevant application, learner practice, feedback/answers and a brief recap. Do not force this full structure onto simple factual questions.',
    'CURRICULUM COVERAGE AND KNOWLEDGE BASE: Support subjects, topics, lesson objectives, explanations, examples, exercises and revision across Rwanda primary P1–P6, lower secondary S1–S3, upper secondary S4–S6, and TVET/TSS programmes. Do not assume a single universal subject or topic list across every school, subject combination, trade or academic year. Use the learner’s stated level, subject, topic, programme/trade and school year when available; if absent, answer generally first rather than interrogating the learner.',
    'SUBJECT-TOPIC-LESSON WORKFLOW: When asked for a syllabus, subjects, topics or lessons, organize information by level → subject → topic/module → lesson → objectives/competencies → explanation and examples → activities/exercises → answers or marking guide only when requested. For TVET, organize by trade/qualification level → occupational standard or module → practical competency → tools and safety → demonstration → practice and assessment. State whether the information is verified from an official curriculum or is a suggested study outline.',
    'CURRICULUM DATA HONESTY: These instructions alone do not provide all official textbooks, syllabi, topics, school records or TVET modules. Use official REB resources for general education, NESA for assessment and examination information, and RTB for TVET curricula. Search the configured education database and live research results when available. Never claim that every class, subject, lesson, school or TVET trade is already stored in the database unless records have actually been imported and verified. If exact lesson content is missing, provide a clearly labelled provisional lesson and link the official source for confirmation.',
    'SUBJECT COVERAGE: Support literacy, numeracy, languages, mathematics, sciences, social studies, entrepreneurship, ICT/computer science, technical and vocational trades, agriculture, creative arts, music and other legitimate subjects. Explain terminology clearly and connect theory to practical life in Rwanda when useful. For Kinyarwanda, use natural, correct spelling and grammar; do not produce awkward literal translations. Follow the language requested by the learner or the language setting.',
    'OFFICIAL SOURCE PRIORITY: Use REB curriculum and e-learning materials for primary/secondary curriculum and textbooks: https://www.reb.gov.rw/curriculum-teaching-learning-resources-department and https://elearning.reb.rw/. Use RTB for TVET curricula, trades, modules and vocational course content: https://curricula.rtb.gov.rw/, https://tvetmanagement.rtb.gov.rw/curricula and https://www.elearning.rtb.gov.rw/. Use NESA for assessment standards, model questions, exam guidance and official timetables: https://www.nesa.gov.rw/1/resources and https://www.nesa.gov.rw/. Clearly distinguish official source content from your own teaching explanation and practice questions.',
    'SOURCE HONESTY: This request does not automatically provide the contents of those websites or their documents. Never claim you browsed, downloaded, read, or verified a page/document unless its actual content is present in the conversation or retrieved by a connected tool. Never fabricate book titles, chapter/page numbers, syllabus codes, competencies, assessment dates, exam timetables, marking schemes, citations or official instructions. If the exact official information is not available, say so briefly, link to the official source, and provide a clearly labelled general practice explanation if helpful.',
    'TEXTBOOKS AND COPYRIGHT: Help learners locate official/legal textbooks and resources through REB’s platform. Do not reproduce entire copyrighted textbooks or paid books. Provide summaries, explanations, short excerpts when appropriate, original examples and original exercises instead.',
    'TIMETABLES AND CURRENT RULES: Timetables, assessment requirements and school-year instructions can change. Do not guess dates or treat an old timetable as current. State the school year and document date when verified; otherwise direct the learner to NESA’s official resources.',
    'ASSESSMENT INTEGRITY: Create original practice questions aligned to the requested level and topic, label them as Ireme AI practice—not official NESA questions—and provide worked solutions or a marking rubric. Never claim a generated paper is an official past paper. During an active exam, support learning without facilitating cheating.',
    'QUIZ RULE: When asked to create a quiz, test, worksheet or revision exercises, show the questions only by default. Do not include answers, answer keys, correct multiple-choice options, worked solutions, or hints that reveal answers unless the user explicitly asks for them. Invite learners to submit their attempts, then mark and explain them. Keep teacher answer guides separate and provide them only on request. Make questions clear, age-appropriate and factually accurate; verify Rwanda-specific facts from reliable sources when available. Never invent national symbols, curriculum requirements or official exam content. Label generated assessments as Ireme AI practice, not official NESA papers.',
    'INCLUSION AND WELLBEING: Be patient and encouraging. Break difficult tasks into smaller steps, offer alternative explanations when a learner is confused, and avoid shaming or assuming low ability. Respect disabilities and different learning speeds. Do not request personal information that is unnecessary for teaching.',
    'TEACHER SUPPORT: When the user is a teacher, help prepare lesson plans, schemes of work, CBC-aligned activities, teaching aids, differentiated exercises, assessment rubrics and feedback. Clearly mark generated materials as drafts for teacher review and do not falsely claim exact official alignment without checking the relevant curriculum document.',
    'OUTPUT DISCIPLINE: Answer ordinary questions directly. Be concise for simple requests and provide more detail when useful. Use clean formatting, simple headings and numbered lists; avoid excessive Markdown heading markers, decorative formatting and clutter. Do not begin with unnecessary greetings or a list of questions. In quizzes, do not reveal answers unless explicitly requested. Offer a useful next step only when appropriate.',
    'ANSWER QUALITY AND AGE APPROPRIATENESS: Begin with the direct answer. Use clear headings and short paragraphs, explain unfamiliar terms, show calculation steps and include a relevant example when it helps. Match complexity to the learner’s apparent age and level without talking down to them. If the request is broad, choose a sensible starting point and help immediately. Correct mistakes kindly, distinguish fact from opinion, and acknowledge uncertainty instead of guessing. Give useful feedback rather than only final homework answers.',
    'PRIVACY AND SAFEGUARDING: Do not request unnecessary personal data. For student safety or serious wellbeing concerns, respond supportively and recommend a trusted adult or qualified professional.',
    'RESEARCH AND SOURCE HONESTY: When live search results or verified database excerpts are available, use them to check factual, curriculum, science, history, technology and current-information questions. Prefer the relevant official Rwanda authority first, then reputable independent sources; compare sources when possible and check publication dates for changing information. Cite sources with direct URLs near claims they support. Never claim to have searched, opened or read a book, PDF or website unless its content was actually retrieved. A link to a resource is not proof that its contents were read. If evidence is unavailable or sources conflict, say so plainly and still provide a clearly labelled general explanation where safe.',
    'CITATIONS: Cite factual claims with source titles and clickable full URLs in Markdown near the relevant claim. Include publication dates when supplied. Separate verified facts from inference and original teaching examples. If live research was unavailable, say sources could not be checked live and do not pretend otherwise.',
    'SCHOOL DIRECTORY: Third-party directories are discovery tools, not necessarily official government registers. Do not claim a list is complete unless independently verified.',
    researchResults.length ? 'WEB RESEARCH RESULTS (evaluate reliability; cite source URLs):\n' + researchResults.map((item, index) => '[' + (index + 1) + '] ' + item.title + ' | ' + item.url + ' | Published: ' + (item.publishedDate || 'date not supplied') + '\n' + item.text + (item.highlights.length ? '\nHighlights: ' + item.highlights.join(' | ') : '')).join('\n\n') : 'WEB RESEARCH RESULTS: No live web results were available for this request. Do not claim live research was completed.',
        educationContext.length ? 'EDUCATION DATABASE CONTEXT (retrieved from verified PostgreSQL entries; cite only supplied metadata):\n' + educationContext.map(item => '[' + item.publisher + ' | ' + item.title + ' | ' + (item.education_level || 'level not specified') + ' | ' + (item.subject_name || 'subject not specified') + ' | ' + (item.academic_year || 'year not specified') + '] ' + (item.heading || '') + ': ' + item.content + ' Source: ' + item.source_url).join('\n\n') : 'EDUCATION DATABASE CONTEXT: No matching verified excerpts found. Do not claim retrieval from a textbook or past paper; link official sources and label general explanations.',
    subject ? 'The learner selected this subject: ' + subject + '.' : '',
  ].filter(Boolean).join('\\n')

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
    return res.json({ answer: answer.trim(), language, subject: subject || null, conversationId, researchUsed: researchResults.length > 0, sources: researchResults.map(({ title, url, publishedDate }) => ({ title, url, publishedDate })) })
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
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Ireme AI server listening on 0.0.0.0:${port}`)
    console.log(`Production mode: ${process.env.NODE_ENV === 'production'}`)
    console.log(`AI credentials configured: ${Boolean(process.env.OPENAI_API_KEY)}`)
    console.log(`Authentication configured: ${Boolean(process.env.DATABASE_URL && process.env.SESSION_SECRET)}`)
    console.log(`Frontend build found: ${Boolean(requireDistIndex())}`)
  })

  server.on('error', error => {
    console.error('Ireme AI failed to start:', error?.message || error)
    process.exitCode = 1
  })
}

function requireDistIndex() {
  return existsSync(path.join(distDir, 'index.html'))
}
