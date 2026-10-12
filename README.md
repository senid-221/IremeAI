# IremeAI — Education Agent Platform

**Ireme AI** is a bilingual education platform foundation for Rwanda, designed to help students learn and prepare for future teacher and school-administration workflows.

## Implemented foundation

- Responsive student dashboard with subject cards, sample learning metrics, study schedule, and progress visuals
- Dedicated My Learning, Study Library, Learning Progress, Schedule, and Help pages
- English / Kinyarwanda interface toggle
- Real Lucide React icons, Framer Motion micro-interactions, and Pixabay-hosted photography
- Node.js / Express backend serving the built frontend
- `GET /api/health` health endpoint
- `POST /api/ask` educational tutoring endpoint connected to an OpenAI-compatible chat-completions API
- Server-side API credentials, input validation, request-size limits, basic per-IP rate limiting, and optional origin restriction
- PostgreSQL-backed student registration and login foundation with bcrypt password hashing and HTTP-only database-backed sessions
- Role-checked teacher and administrator API examples; privileged roles cannot be selected during public registration

> **Important status note:** The current UI still contains sample student metrics and illustrative resources. The tutor can call a real AI provider after server configuration. Student registration, login, session management, and role-checked API examples are implemented but only activate when PostgreSQL and a session secret are configured. Curriculum RAG, verified NESA documents, persistent tutor conversations/progress, and complete teacher/admin workspaces are not implemented yet. Do not treat sample metrics as real school results or enter sensitive student information.

## PostgreSQL data model (foundation added)

A reviewed initial schema is available at `db/migrations/001_initial_schema.sql`. It defines schools, user accounts and roles, classes and memberships, subjects, learning resources, assignments and submissions, tutor conversations/messages, learning progress, and curriculum-source approval metadata.

**The database schema is not applied automatically.** Review the SQL, provision PostgreSQL, and apply the migration before enabling accounts. The authentication API now uses PostgreSQL when both `DATABASE_URL` and `SESSION_SECRET` are configured; otherwise account endpoints return a safe configuration error. Chat history and learning progress are not yet persisted. Do not store plaintext passwords or enter sensitive student information before deploying appropriate access controls and privacy processes.

## Technology

- React 18 + TypeScript + Vite
- Express 4 + Node.js
- Lucide React + Framer Motion
- OpenAI-compatible chat completions API (server-side only)

## Run locally

1. Install Node.js 22 or newer.
2. Install dependencies:

```bash
npm install
```

3. Copy `.env.example` to `.env`. Set `OPENAI_API_KEY`, `DATABASE_URL`, and a strong random `SESSION_SECRET` on the server. Generate the session secret with a secure random generator (at least 32 random bytes). Never put secrets in frontend variables such as `VITE_OPENAI_API_KEY`.
4. Apply `db/migrations/001_initial_schema.sql` to a new PostgreSQL database after reviewing it. The session library creates its own `user_sessions` table when auth is configured.
5. Start the backend in one terminal:

```bash
npm run dev:api
```

6. Start the Vite frontend in a second terminal:

```bash
npm run dev
```

The Vite development server proxies `/api` requests to `http://localhost:8787`.

## Production build and run

```bash
npm run build
npm start
```

Set the hosting service's start command to `npm start` and configure `OPENAI_API_KEY`, `OPENAI_MODEL`, `PORT`, `DATABASE_URL`, and a strong `SESSION_SECRET` in its server environment. In production, HTTPS is required for secure session cookies. The Express server serves the production `dist` directory and the API from the same origin.

## Tests

Run the backend endpoint tests with:

\`\`\`bash
npm test
\`\`\`

The test suite checks health output, AI request validation/configuration, safe auth configuration failures, and unauthenticated access denial for teacher/admin endpoints. GitHub Actions runs the frontend build, backend syntax check, and API tests.

## Authentication API

- `POST /api/auth/register` — creates a student account; accepts `fullName`, `email`, `password` (10–128 characters), and optional `preferredLanguage` (`en` or `rw`). Public registration never accepts a role.
- `POST /api/auth/login` — verifies the password and active account status, then rotates the session ID.
- `GET /api/auth/me` — returns the current active user's safe profile.
- `POST /api/auth/logout` — destroys the session.
- `GET /api/teacher/overview` — example route limited to teacher, school-admin, and platform-admin roles.
- `GET /api/admin/overview` — example route limited to school-admin and platform-admin roles.

Sessions use an HTTP-only cookie, PostgreSQL session storage, and `SameSite=Lax`; cookies are marked Secure in production. Account services remain disabled unless both `DATABASE_URL` and `SESSION_SECRET` are set. Create or promote privileged users only through a controlled administrative process, never through public registration. The protected overview routes are authorization examples, not finished teacher/admin dashboards.

## API endpoints

### `GET /api/health`

Returns service health and whether the AI key is configured. It does not expose the key.

### `POST /api/ask`

Example body:

```json
{
  "question": "Can you explain linear equations step by step?",
  "language": "en"
}
```

`language` accepts `en` or `rw`. Optional `subject` can provide a short subject label. Questions are limited to 4,000 characters. The endpoint returns a clear configuration error if no API key is set.

## Environment variables

See `.env.example`. Do not commit real API keys, database credentials, or secrets. Configure production secrets in the hosting provider's environment settings.

## Next implementation milestones

1. Connect tutor conversations and learning progress to the authenticated user's PostgreSQL records.
2. Build a verified Rwanda curriculum knowledge base with retrieval, document provenance, and source citations.
3. Build complete teacher and school-admin workspaces for classes, assignments, submissions, and feedback.
4. Replace illustrative dashboard statistics with authenticated, permission-checked data.
5. Add a controlled admin bootstrap/invitation workflow and production-grade abuse monitoring.
6. Add end-to-end verification, deployment checks, and privacy/data-retention controls.
