# WorkWise

WorkWise is an AI-assisted project management workspace for small development teams. It brings project planning, sprint execution, kanban task tracking, documentation, notifications, and AI-generated planning support into one full-stack application.

## Documentation

- [API documentation](docs/API.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Architecture overview](docs/ARCHITECTURE.md)
- [Mermaid architecture diagram](docs/architecture-diagram.mmd)

## Key Features

- JWT authentication with refresh tokens and password reset email flow
- Project workspaces with members, invitations, and role-based permissions
- Task backlog, kanban board, assignment, labels, priority, due dates, comments, and linked documents
- Sprint creation, activation, completion, document linking, and retrospective generation
- Project documentation with rich text content and searchable documents
- Activity feed for project-level changes
- Notification center with user notification preferences
- Socket.io realtime updates for project rooms and user notifications
- Gemini AI integration for task breakdown, acceptance criteria, daily digests, and sprint retrospectives

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, TypeScript, React Router, TanStack Query, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, typically hosted on Supabase |
| ORM | Prisma |
| Realtime | Socket.io |
| AI | Google Gemini via `@google/genai` |
| Auth | JWT access and refresh tokens, bcrypt password hashing |
| Email | SMTP with optional Resend fallback |
| Testing | Vitest, Testing Library, Supertest |
| Hosting | Vercel for frontend, Render for backend |

## Prerequisites

- Node.js 18 or newer
- npm
- Git
- A PostgreSQL database, such as Supabase
- Optional: Google Gemini API key for AI features
- Optional: SMTP or Resend credentials for password reset and invitation emails

## Local Setup

Clone the repository and install dependencies separately for the client and server.

```bash
git clone <repo-url>
cd WorkWise

npm install --prefix client
npm install --prefix server
```

Create environment files from the examples.

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

Edit the copied `.env` files with local or development credentials. Do not commit real secrets.

Run Prisma generation and migrations from the server directory.

```bash
cd server
npx prisma generate
npm run db:migrate
```

Start the backend and frontend in separate terminals.

```bash
cd server
npm run dev
```

```bash
cd client
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: http://localhost:<PORT> (defaults to 5000 unless overridden).

## Environment Variables

### Client

Defined in [client/.env.example](client/.env.example).

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Yes | Backend API origin used by the Vite frontend, for example `http://localhost:3000` or a Render URL. |

Only variables prefixed with `VITE_` are exposed to browser code.

### Server

Defined in [server/.env.example](server/.env.example).

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Runtime PostgreSQL connection string. For Supabase pooler transaction mode, include `?pgbouncer=true`. |
| `DIRECT_URL` | Yes | Direct/session PostgreSQL connection string used by Prisma migrations and generation. |
| `JWT_SECRET` | Yes | Secret for signing access tokens. |
| `JWT_REFRESH_SECRET` | Yes | Secret for signing refresh tokens. Use a different value from `JWT_SECRET`. |
| `PORT` | No | Express server port. Render provides this automatically in production. |
| `NODE_ENV` | No | Runtime environment, usually `development` or `production`. |
| `FRONTEND_URL` | No | Allowed CORS origin and frontend URL used in email links. |
| `GEMINI_API_KEY` | Required for AI | Google Gemini API key for AI generation features. |
| `DAILY_DIGEST_SCHEDULER_ENABLED` | No | Enables scheduled daily digest generation when set for the scheduler. |
| `DAILY_DIGEST_HOUR_UTC` | No | UTC hour used by the daily digest scheduler. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Required for SMTP email | SMTP credentials and sender metadata for password reset and invitations. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional | Optional transactional email fallback. |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Optional | Supabase API values if direct Supabase REST/Auth calls are added or enabled. |

## Build and Test Commands

Run commands from the relevant package directory.

### Client

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Type-check and build the production frontend. |
| `npm run preview` | Preview the built frontend locally. |
| `npm run test` | Run client tests with Vitest. |
| `npm run test:coverage` | Run client tests with coverage. |
| `npm run lint` | Run ESLint. |

### Server

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Express with `ts-node-dev`. |
| `npm run build` | Compile TypeScript into `dist/`. |
| `npm start` | Run the compiled backend from `dist/server.js`. |
| `npm run test` | Run server tests with Vitest. |
| `npm run test:coverage` | Run server tests with coverage. |
| `npm run db:migrate` | Run `prisma migrate dev`. |
| `npm run db:seed` | Seed the database with `prisma/seed.js`. |
| `npm run db:reset` | Reset the database with Prisma. |
| `npx prisma generate` | Generate the Prisma client after schema or dependency changes. |

## Basic Project Structure

```text
WorkWise/
  client/
    src/
      components/       Reusable UI and app components
      context/          React context providers
      hooks/            Shared React hooks
      pages/            Route-level screens
      routes/           React Router setup
      services/         API, auth, realtime, and domain clients
    vercel.json         Vercel SPA rewrite configuration
  server/
    prisma/
      schema.prisma     Database models and enums
      migrations/       Prisma migration history
      seed.js           Seed script
    src/
      controllers/      Express request handlers
      middleware/       Auth, validation, rate limit, and error middleware
      modules/          Feature modules such as projects, users, and AI
      routes/           REST route definitions
      services/         Business logic and integrations
      validators/       Zod and express-validator schemas
      app.ts            Express app configuration and route mounting
      server.ts         HTTP and Socket.io server bootstrap
  docs/                 API, deployment, and architecture documentation
```

## Git Workflow

This project uses a two-branch model with `main` and `develop`.

- `main`: production-ready code.
- `develop`: active development branch.
- Feature branches should use the Jira ticket number, for example `feature/SCRUM-179-project-documentation`.
- Open pull requests into `develop` and keep branches focused on one task.

## Development Notes

- All protected HTTP endpoints expect `Authorization: Bearer <accessToken>`.
- Socket.io clients authenticate with the same access token in `handshake.auth.token`.
- The backend CORS origin is controlled by `FRONTEND_URL`.
- Prisma uses `DATABASE_URL` at runtime and `DIRECT_URL` for migrations.
- Keep generated secrets, API keys, database passwords, and SMTP credentials out of git.
