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

> **Important status note:** The current UI still contains sample student metrics and illustrative resources. The tutor can call a real AI provider after server configuration, but the system does not yet have curriculum RAG, verified NESA documents, authentication, PostgreSQL persistence, real student records, or teacher/admin workspaces. Do not use sample metrics as real school results or enter sensitive student information.

## PostgreSQL data model (foundation added)

A reviewed initial schema is available at `db/migrations/001_initial_schema.sql`. It defines schools, user accounts and roles, classes and memberships, subjects, learning resources, assignments and submissions, tutor conversations/messages, learning progress, and curriculum-source approval metadata.

**This is a schema foundation, not a live database integration.** The current API does not connect to PostgreSQL, create accounts, authenticate users, or persist chat history yet. No migration is run automatically. Review the SQL, provision a PostgreSQL database, and apply the migration deliberately before adding production student data. Password hashes are represented as a nullable field for a future authentication implementation; do not store plaintext passwords.

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

3. Copy `.env.example` to `.env` and set `OPENAI_API_KEY` on the server side. Never put provider credentials in frontend variables such as `VITE_OPENAI_API_KEY`.
4. Start the backend in one terminal:

```bash
npm run dev:api
```

5. Start the Vite frontend in a second terminal:

```bash
npm run dev
```

The Vite development server proxies `/api` requests to `http://localhost:8787`.

## Production build and run

```bash
npm run build
npm start
```

Set the hosting service's start command to `npm start` and configure `OPENAI_API_KEY`, `OPENAI_MODEL`, and `PORT` in its server environment. The Express server serves the production `dist` directory and the API from the same origin.

## Tests

Run the backend endpoint tests with:

\`\`\`bash
npm test
\`\`\`

The test suite checks health output, empty-question validation, and the safe response when the AI key is not configured. GitHub Actions also runs the frontend build and backend syntax check.

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

1. Add secure authentication and role-based access for students, teachers, school admins, and platform admins.
2. Add PostgreSQL schema and migrations for users, schools, classes, lessons, assignments, conversations, and progress.
3. Build an approved Rwanda curriculum knowledge base with retrieval, document provenance, and source citations.
4. Add teacher-reviewed assessment and grading workflows.
5. Replace illustrative dashboard statistics with authenticated, permission-checked data.
6. Add automated API tests, abuse protection suitable for production, and end-to-end verification.
