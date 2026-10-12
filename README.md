# IremeAI — Education Agent Platform

**Ireme AI** is a bilingual education platform concept for Rwanda, designed to help students learn, help teachers prepare lessons, and give schools a clear digital workspace.

## First UI foundation

The initial React + TypeScript + Vite frontend includes:
- Responsive student learning dashboard
- Ireme AI learning-assistant interface with prompt suggestions
- Subject cards and progress tracking
- Weekly activity visualization and study schedule
- English / Kinyarwanda interface toggle
- Real Lucide icons, Framer Motion micro-interactions, and Pixabay-hosted photography
- Mobile navigation, reduced-motion support, and accessible button labels

> **Current implementation status:** this commit establishes the frontend foundation and interactive demo states. The AI response is a clearly limited demo, not a connected AI model. Authentication, live school data, curriculum retrieval, PostgreSQL persistence, teacher/admin workspaces, and production integrations still need to be implemented before real student data is used.

## Technology

- React 18 + TypeScript
- Vite
- Lucide React icons
- Framer Motion
- CSS responsive layout

## Run locally

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
npm run preview
```

## Environment variables

See `.env.example`. Do not commit real API keys, database credentials, or secrets. Configure production secrets in the hosting provider's environment settings.

## Next implementation milestones

1. Add authentication and role-based access for students, teachers, school admins, and platform admins.
2. Connect an AI provider through a server-side API; never expose provider secrets in browser code.
3. Build an approved curriculum knowledge base with source-grounded retrieval.
4. Add PostgreSQL models and migrations for users, schools, classes, lessons, conversations, assignments, and progress.
5. Add teacher-reviewed assessment workflows, school analytics, audit logs, and privacy safeguards.
6. Add automated tests and confirm the deployment build in CI.
