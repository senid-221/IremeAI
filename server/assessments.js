export function registerAssessmentRoutes(app, { requireAuth, requireRole, uuidPattern }) {
  // Correct answers remain private until the learner submits an attempt.
  app.get('/api/assessments', requireAuth, async (req, res) => {
    const pool = req.app.locals.authPool
    if (!pool) return res.status(503).json({ error: 'Assessment database is not configured.' })
    const subject = typeof req.query.subject === 'string' ? req.query.subject.trim().slice(0, 100) : ''
    const level = typeof req.query.level === 'string' ? req.query.level.trim().slice(0, 60) : ''
    try {
      const result = await pool.query(
        "SELECT a.id, a.title, a.instructions, a.grade_level, a.language, a.duration_minutes, a.is_published, a.created_at, s.name AS subject_name, s.name_rw AS subject_name_rw, u.full_name AS teacher_name, count(q.id)::int AS question_count FROM assessments a LEFT JOIN subjects s ON s.id = a.subject_id LEFT JOIN users u ON u.id = a.created_by LEFT JOIN assessment_questions q ON q.assessment_id = a.id WHERE (a.is_published = true OR a.created_by = $1) AND ($2 = '' OR coalesce(s.name,'') ILIKE '%' || $2 || '%' OR coalesce(s.name_rw,'') ILIKE '%' || $2 || '%') AND ($3 = '' OR coalesce(a.grade_level,'') ILIKE '%' || $3 || '%') GROUP BY a.id, s.name, s.name_rw, u.full_name ORDER BY a.is_published DESC, a.created_at DESC LIMIT 100",
        [req.session.userId, subject, level],
      )
      return res.json({ assessments: result.rows })
    } catch (error) {
      console.error('Assessment list failed:', error?.message || 'unknown error')
      return res.status(500).json({ error: 'Could not load assessments.' })
    }
  })

  app.get('/api/assessments/:id', requireAuth, async (req, res) => {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json({ error: 'Assessment ID is invalid.' })
    const pool = req.app.locals.authPool
    if (!pool) return res.status(503).json({ error: 'Assessment database is not configured.' })
    try {
      const assessment = await pool.query(
        "SELECT a.id, a.title, a.instructions, a.grade_level, a.language, a.duration_minutes, a.is_published, a.created_by, s.name AS subject_name, s.name_rw AS subject_name_rw FROM assessments a LEFT JOIN subjects s ON s.id = a.subject_id WHERE a.id = $1 AND (a.is_published = true OR a.created_by = $2) LIMIT 1",
        [req.params.id, req.session.userId],
      )
      if (!assessment.rowCount) return res.status(404).json({ error: 'Assessment not found.' })
      const questions = await pool.query(
        "SELECT id, question_order, prompt, options, points FROM assessment_questions WHERE assessment_id = $1 ORDER BY question_order ASC",
        [req.params.id],
      )
      return res.json({ assessment: assessment.rows[0], questions: questions.rows })
    } catch (error) {
      console.error('Assessment detail failed:', error?.message || 'unknown error')
      return res.status(500).json({ error: 'Could not load this assessment.' })
    }
  })

  app.post('/api/assessments', requireRole('teacher', 'school_admin', 'platform_admin'), async (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
    const instructions = typeof req.body?.instructions === 'string' ? req.body.instructions.trim().slice(0, 4000) : ''
    const gradeLevel = typeof req.body?.gradeLevel === 'string' ? req.body.gradeLevel.trim().slice(0, 60) : ''
    const language = req.body?.language === 'rw' ? 'rw' : 'en'
    const durationMinutes = req.body?.durationMinutes === undefined ? 30 : req.body.durationMinutes
    const subjectId = typeof req.body?.subjectId === 'string' ? req.body.subjectId : null
    const questions = req.body?.questions
    if (title.length < 3 || title.length > 180) return res.status(400).json({ error: 'Assessment title must be between 3 and 180 characters.' })
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 360) return res.status(400).json({ error: 'Duration must be between 1 and 360 minutes.' })
    if (subjectId && !uuidPattern.test(subjectId)) return res.status(400).json({ error: 'Subject ID is invalid.' })
    if (!Array.isArray(questions) || questions.length < 1 || questions.length > 100) return res.status(400).json({ error: 'Provide between 1 and 100 multiple-choice questions.' })
    for (const [index, question] of questions.entries()) {
      if (!question || typeof question.prompt !== 'string' || question.prompt.trim().length < 3 || question.prompt.length > 3000) return res.status(400).json({ error: 'Question ' + (index + 1) + ' must have a prompt between 3 and 3000 characters.' })
      if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 8 || question.options.some(option => typeof option !== 'string' || !option.trim() || option.length > 500)) return res.status(400).json({ error: 'Question ' + (index + 1) + ' must have 2 to 8 non-empty options.' })
      if (!Number.isInteger(question.correctOption) || question.correctOption < 0 || question.correctOption >= question.options.length) return res.status(400).json({ error: 'Question ' + (index + 1) + ' must specify a valid correctOption index.' })
      if (question.explanation !== undefined && (typeof question.explanation !== 'string' || question.explanation.length > 3000)) return res.status(400).json({ error: 'Question explanation must be 3000 characters or fewer.' })
      if (question.points !== undefined && (typeof question.points !== 'number' || question.points <= 0 || question.points > 100)) return res.status(400).json({ error: 'Question points must be greater than 0 and at most 100.' })
    }
    const pool = req.app.locals.authPool
    if (!pool) return res.status(503).json({ error: 'Assessment database is not configured.' })
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const created = await client.query(
        "INSERT INTO assessments(created_by, subject_id, title, instructions, grade_level, language, duration_minutes, is_published) VALUES($1,$2,$3,$4,NULLIF($5,''),$6,$7,false) RETURNING id, title, grade_level, language, duration_minutes, is_published",
        [req.session.userId, subjectId, title, instructions, gradeLevel, language, durationMinutes],
      )
      const assessment = created.rows[0]
      for (const [index, question] of questions.entries()) {
        await client.query(
          "INSERT INTO assessment_questions(assessment_id, question_order, prompt, options, correct_option, explanation, points) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7)",
          [assessment.id, index + 1, question.prompt.trim(), JSON.stringify(question.options.map(option => option.trim())), question.correctOption, question.explanation || '', question.points === undefined ? 1 : question.points],
        )
      }
      await client.query('COMMIT')
      return res.status(201).json({ assessment, questionCount: questions.length, message: 'Assessment saved as a draft. Publish it when it is ready for learners.' })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      console.error('Assessment create failed:', error?.message || 'unknown error')
      return res.status(500).json({ error: 'Could not create assessment.' })
    } finally {
      client.release()
    }
  })

  app.post('/api/assessments/:id/publish', requireRole('teacher', 'school_admin', 'platform_admin'), async (req, res) => {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json({ error: 'Assessment ID is invalid.' })
    const pool = req.app.locals.authPool
    if (!pool) return res.status(503).json({ error: 'Assessment database is not configured.' })
    try {
      const result = await pool.query(
        "UPDATE assessments a SET is_published = true, updated_at = now() WHERE a.id = $1 AND (a.created_by = $2 OR EXISTS (SELECT 1 FROM users u WHERE u.id = $2 AND u.role IN ('school_admin','platform_admin'))) AND EXISTS (SELECT 1 FROM assessment_questions q WHERE q.assessment_id = a.id) RETURNING a.id, a.title, a.is_published",
        [req.params.id, req.session.userId],
      )
      if (!result.rowCount) return res.status(404).json({ error: 'Assessment not found, not yours to publish, or it has no questions.' })
      return res.json({ assessment: result.rows[0] })
    } catch (error) {
      console.error('Assessment publish failed:', error?.message || 'unknown error')
      return res.status(500).json({ error: 'Could not publish assessment.' })
    }
  })

  app.post('/api/assessments/:id/attempts', requireAuth, async (req, res) => {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json({ error: 'Assessment ID is invalid.' })
    const pool = req.app.locals.authPool
    if (!pool) return res.status(503).json({ error: 'Assessment database is not configured.' })
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const assessment = await client.query(
        "SELECT id, title, instructions, grade_level, language, duration_minutes FROM assessments WHERE id = $1 AND is_published = true LIMIT 1",
        [req.params.id],
      )
      if (!assessment.rowCount) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Published assessment not found.' })
      }
      const questions = await client.query(
        "SELECT id, question_order, prompt, options, points FROM assessment_questions WHERE assessment_id = $1 ORDER BY question_order",
        [req.params.id],
      )
      if (!questions.rowCount) {
        await client.query('ROLLBACK')
        return res.status(409).json({ error: 'This assessment has no questions yet.' })
      }
      const attempt = await client.query(
        "INSERT INTO assessment_attempts(assessment_id, student_id, max_score) SELECT $1, $2, coalesce(sum(points),0) FROM assessment_questions WHERE assessment_id = $1 RETURNING id, started_at, max_score",
        [req.params.id, req.session.userId],
      )
      await client.query('COMMIT')
      return res.status(201).json({ assessment: assessment.rows[0], attempt: attempt.rows[0], questions: questions.rows })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      console.error('Assessment attempt start failed:', error?.message || 'unknown error')
      return res.status(500).json({ error: 'Could not start this assessment.' })
    } finally {
      client.release()
    }
  })

  app.post('/api/assessment-attempts/:id/submit', requireAuth, async (req, res) => {
    if (!uuidPattern.test(req.params.id)) return res.status(400).json({ error: 'Attempt ID is invalid.' })
    const answers = req.body?.answers
    if (!Array.isArray(answers) || answers.length > 200) return res.status(400).json({ error: 'Provide an answers array.' })
    const answerMap = new Map()
    for (const answer of answers) {
      if (!answer || typeof answer.questionId !== 'string' || !uuidPattern.test(answer.questionId)) return res.status(400).json({ error: 'Each answer must include a valid questionId.' })
      if (answer.selectedOption !== null && (!Number.isInteger(answer.selectedOption) || answer.selectedOption < 0 || answer.selectedOption > 7)) return res.status(400).json({ error: 'selectedOption must be an option index or null.' })
      if (answerMap.has(answer.questionId)) return res.status(400).json({ error: 'Duplicate question answers are not allowed.' })
      answerMap.set(answer.questionId, answer.selectedOption)
    }
    const pool = req.app.locals.authPool
    if (!pool) return res.status(503).json({ error: 'Assessment database is not configured.' })
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const attempt = await client.query(
        "SELECT id, assessment_id, student_id, status FROM assessment_attempts WHERE id = $1 AND student_id = $2 FOR UPDATE",
        [req.params.id, req.session.userId],
      )
      if (!attempt.rowCount) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Assessment attempt not found.' })
      }
      if (attempt.rows[0].status !== 'in_progress') {
        await client.query('ROLLBACK')
        return res.status(409).json({ error: 'This attempt has already been submitted.' })
      }
      const questions = await client.query(
        "SELECT id, question_order, prompt, options, correct_option, explanation, points FROM assessment_questions WHERE assessment_id = $1 ORDER BY question_order",
        [attempt.rows[0].assessment_id],
      )
      let score = 0
      let maxScore = 0
      const review = []
      for (const question of questions.rows) {
        const selectedOption = answerMap.has(question.id) ? answerMap.get(question.id) : null
        if (selectedOption !== null && selectedOption >= question.options.length) {
          await client.query('ROLLBACK')
          return res.status(400).json({ error: 'One or more selected options do not exist for their question.' })
        }
        const isCorrect = selectedOption !== null && selectedOption === question.correct_option
        const awarded = isCorrect ? Number(question.points) : 0
        score += awarded
        maxScore += Number(question.points)
        await client.query(
          "INSERT INTO assessment_answers(attempt_id, question_id, selected_option, is_correct, points_awarded) VALUES($1,$2,$3,$4,$5)",
          [req.params.id, question.id, selectedOption, isCorrect, awarded],
        )
        review.push({
          questionId: question.id, questionOrder: question.question_order, prompt: question.prompt,
          options: question.options, selectedOption, correctOption: question.correct_option,
          isCorrect, pointsAwarded: awarded, points: Number(question.points), explanation: question.explanation,
        })
      }
      await client.query(
        "UPDATE assessment_attempts SET submitted_at = now(), score = $2, max_score = $3, status = 'submitted' WHERE id = $1",
        [req.params.id, score, maxScore],
      )
      await client.query('COMMIT')
      return res.json({ attemptId: req.params.id, score, maxScore, percentage: maxScore ? Math.round((score / maxScore) * 10000) / 100 : 0, review })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      console.error('Assessment submit failed:', error?.message || 'unknown error')
      return res.status(500).json({ error: 'Could not submit this assessment.' })
    } finally {
      client.release()
    }
  })

  app.get('/api/assessment-attempts', requireAuth, async (req, res) => {
    const pool = req.app.locals.authPool
    if (!pool) return res.status(503).json({ error: 'Assessment database is not configured.' })
    try {
      const result = await pool.query(
        "SELECT t.id, t.assessment_id, a.title AS assessment_title, s.name AS subject_name, t.started_at, t.submitted_at, t.score, t.max_score, t.status, CASE WHEN t.max_score > 0 AND t.score IS NOT NULL THEN round(t.score / t.max_score * 100, 2) ELSE NULL END AS percentage FROM assessment_attempts t JOIN assessments a ON a.id = t.assessment_id LEFT JOIN subjects s ON s.id = a.subject_id WHERE t.student_id = $1 ORDER BY t.started_at DESC LIMIT 100",
        [req.session.userId],
      )
      return res.json({ attempts: result.rows })
    } catch (error) {
      console.error('Assessment history failed:', error?.message || 'unknown error')
      return res.status(500).json({ error: 'Could not load assessment history.' })
    }
  })
}
