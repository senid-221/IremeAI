import bcrypt from 'bcryptjs'
import pg from 'pg'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import { Router } from 'express'

const { Pool } = pg
const PgSessionStore = connectPgSimple(session)

function publicUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
    preferredLanguage: row.preferred_language,
    gradeLevel: row.grade_level,
    schoolId: row.school_id,
  }
}

function unavailable(res) {
  return res.status(503).json({
    error: 'Account services are not configured. Set DATABASE_URL and SESSION_SECRET on the server.',
    code: 'AUTH_NOT_CONFIGURED',
  })
}

export function configureAuth(app) {
  const databaseUrl = process.env.DATABASE_URL
  const sessionSecret = process.env.SESSION_SECRET
  const ready = Boolean(databaseUrl && sessionSecret)
  const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 10, idleTimeoutMillis: 30_000 }) : null

  if (ready) {
    app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false)
    app.use(session({
      name: 'ireme.sid',
      secret: sessionSecret,
      store: new PgSessionStore({
        pool,
        tableName: 'user_sessions',
        createTableIfMissing: true,
        pruneSessionInterval: 60 * 15,
      }),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }))
  }

  app.locals.authPool = pool
  app.locals.authConfigured = ready

  const router = Router()
  router.use((req, res, next) => {
    if (!ready || !pool) return unavailable(res)
    next()
  })

  router.post('/register', async (req, res) => {
    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : ''
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    const preferredLanguage = req.body?.preferredLanguage === 'rw' ? 'rw' : 'en'

    if (fullName.length < 2 || fullName.length > 160) {
      return res.status(400).json({ error: 'Full name must be between 2 and 160 characters.' })
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' })
    }
    if (password.length < 10 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ error: 'Password must be at least 10 characters and no more than 72 UTF-8 bytes.' })
    }

    try {
      const passwordHash = await bcrypt.hash(password, 12)
      const result = await pool.query(
        `INSERT INTO users (full_name, email, password_hash, role, status, preferred_language)
         VALUES ($1, $2, $3, 'student', 'active', $4)
         RETURNING id, full_name, email, role, status, preferred_language, grade_level, school_id`,
        [fullName, email, passwordHash, preferredLanguage],
      )
      req.session.regenerate(error => {
        if (error) return res.status(500).json({ error: 'Could not start a secure session.' })
        req.session.userId = result.rows[0].id
        req.session.role = result.rows[0].role
        req.session.save(saveError => {
          if (saveError) return res.status(500).json({ error: 'Could not save your session. Please sign in.' })
          return res.status(201).json({ user: publicUser(result.rows[0]) })
        })
      })
    } catch (error) {
      if (error?.code === '23505') return res.status(409).json({ error: 'An account with this email already exists.' })
      console.error('Registration failed:', error?.message || 'unknown error')
      return res.status(500).json({ error: 'Could not create your account right now.' })
    }
  })

  router.post('/login', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    if (!email || !password || email.length > 254 || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ error: 'Enter your email and password.' })
    }

    try {
      const result = await pool.query(
        `SELECT id, full_name, email, password_hash, role, status, preferred_language, grade_level, school_id
         FROM users WHERE email = $1 LIMIT 1`,
        [email],
      )
      const user = result.rows[0]
      const validPassword = user?.password_hash ? await bcrypt.compare(password, user.password_hash) : false
      if (!user || !validPassword || user.status !== 'active') {
        return res.status(401).json({ error: 'Email or password is incorrect, or the account is not active.' })
      }

      req.session.regenerate(error => {
        if (error) return res.status(500).json({ error: 'Could not start a secure session.' })
        req.session.userId = user.id
        req.session.role = user.role
        req.session.save(async saveError => {
          if (saveError) return res.status(500).json({ error: 'Could not save your session. Please try again.' })
          try {
            await pool.query('UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1', [user.id])
            return res.json({ user: publicUser(user) })
          } catch (updateError) {
            console.error('Login timestamp update failed:', updateError?.message || 'unknown error')
            return res.json({ user: publicUser(user) })
          }
        })
      })
    } catch (error) {
      console.error('Login failed:', error?.message || 'unknown error')
      return res.status(500).json({ error: 'Could not sign in right now.' })
    }
  })

  router.get('/me', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Please sign in to continue.' })
    try {
      const result = await pool.query(
        'SELECT id, full_name, email, role, status, preferred_language, grade_level, school_id FROM users WHERE id = $1 LIMIT 1',
        [req.session.userId],
      )
      const user = result.rows[0]
      if (!user || user.status !== 'active') {
        return req.session.destroy(() => res.status(401).json({ error: 'Your session is no longer active.' }))
      }
      return res.json({ user: publicUser(user) })
    } catch (error) {
      console.error('Session lookup failed:', error?.message || 'unknown error')
      return res.status(500).json({ error: 'Could not verify your session right now.' })
    }
  })

  router.post('/logout', (req, res) => {
    if (!req.session) return res.status(204).end()
    req.session.destroy(error => {
      if (error) return res.status(500).json({ error: 'Could not sign out cleanly.' })
      res.clearCookie('ireme.sid', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      })
      return res.status(204).end()
    })
  })

  app.use('/api/auth', router)
  return { pool, configured: ready }
}

export function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Please sign in to continue.' })
  return next()
}

export function requireRole(...roles) {
  return async (req, res, next) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Please sign in to continue.' })
    const pool = req.app.locals.authPool
    if (!pool) return res.status(503).json({ error: 'Account services are not configured.' })
    try {
      const result = await pool.query('SELECT role, status FROM users WHERE id = $1 LIMIT 1', [req.session.userId])
      const user = result.rows[0]
      if (!user || user.status !== 'active') return res.status(401).json({ error: 'Your session is no longer active.' })
      req.session.role = user.role
      if (!roles.includes(user.role)) return res.status(403).json({ error: 'You do not have permission to access this resource.' })
      return next()
    } catch (error) {
      console.error('Role authorization failed:', error?.message || 'unknown error')
      return res.status(500).json({ error: 'Could not verify your access right now.' })
    }
  }
}
