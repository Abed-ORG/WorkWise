# Workwise

An AI-powered project management platform built for small development teams. Workwise replaces the fragmented workflow of juggling multiple tools by combining task tracking, sprint planning, kanban boards, and documentation in one place — with AI deeply integrated into the core workflow.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite) + TailwindCSS |
| Backend | Node.js / Express |
| Database | PostgreSQL on Supabase |
| ORM | Prisma |
| AI | Google Gemini API |
| Real-Time | Socket.io |
| Auth | JWT |
| Hosting | Vercel (frontend) + Render (backend) |

## Project Structure

```
workwise/
├── client/          # React frontend
├── server/          # Node.js/Express backend
├── .gitignore
└── README.md
```

## Team

| Name | Role |
|------|------|
| Taimour Shmait | Developer |
| Yehia Fayyad | Developer |
| Hadi Wehbe | Developer |

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Git
- VS Code (recommended)
- PostgreSQL client (for connecting to Supabase)

### Setup

1. Clone the repo:
   ```bash
   git clone <repo-url>
   cd workwise
   ```

2. Switch to the `develop` branch:
   ```bash
   git checkout develop
   ```

3. Install frontend dependencies:
   ```bash
   cd client
   npm install
   ```

4. Install backend dependencies:
   ```bash
   cd ../server
   npm install
   ```

5. Set up environment variables:
   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```
   Fill in real values — see the [Environment Variables](#environment-variables) section below for what each variable does and where to obtain it.

6. Activate the pre-commit hook (one-time per clone — keeps secrets out of git):
   ```bash
   git config core.hooksPath .githooks
   ```

7. Run Prisma migrations:
   ```bash
   npx prisma migrate dev
   ```

7. Start the development servers:
   ```bash
   # Terminal 1 — backend
   cd server
   npm run dev

   # Terminal 2 — frontend
   cd client
   npm run dev
   ```

## Environment Variables

> **Never commit `.env` files.** The pre-commit hook blocks this automatically once you run `git config core.hooksPath .githooks`. Production values (Render / Vercel) are set via each platform's dashboard — never in code.

### Server (`server/.env`)

Copy the template: `cp server/.env.example server/.env`

#### Database — Supabase / PostgreSQL

| Variable | Purpose | Where to get it |
|---|---|---|
| `DATABASE_URL` | Runtime DB connection via pgBouncer transaction-mode pooler (port 6543). Must end with `?pgbouncer=true`. | Supabase dashboard → Settings → Database → Connection string → **Transaction mode** |
| `DIRECT_URL` | Prisma CLI connection (migrations, Studio) via session-mode pooler (port 5432). | Supabase dashboard → Settings → Database → Connection string → **Session mode** |

#### Supabase (optional — only needed for direct Supabase API calls)

| Variable | Purpose | Where to get it |
|---|---|---|
| `SUPABASE_URL` | Project REST API base URL. | Supabase dashboard → Settings → API → Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Anon/public key — safe for client-side use. | Supabase dashboard → Settings → API → `anon` key |
| `SUPABASE_SECRET_KEY` | Service role key — **server-side only, never expose to the browser.** | Supabase dashboard → Settings → API → `service_role` key |

#### Authentication

| Variable | Purpose | Where to get it |
|---|---|---|
| `JWT_SECRET` | Signs access tokens (short-lived). Must be long and random. | Generate: `openssl rand -hex 64` |
| `JWT_REFRESH_SECRET` | Signs refresh tokens. Must differ from `JWT_SECRET`. | Generate: `openssl rand -hex 64` |

#### AI

| Variable | Purpose | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for AI task breakdown and sprint planning features. | [Google AI Studio](https://aistudio.google.com/app/apikey) → Get API key |

#### App

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Port the Express server listens on. Render overrides this automatically. | `3000` |
| `NODE_ENV` | Runtime environment. Use `development` locally, `production` on Render. | `development` |
| `FRONTEND_URL` | Allowed CORS origin and base URL for password-reset email links. | `http://localhost:5173` |

#### Email — SMTP (primary)

Uses the team's Gmail mailbox via a Google App Password. Requires 2-Step Verification to be enabled on the Gmail account.

| Variable | Purpose | Where to get it |
|---|---|---|
| `SMTP_HOST` | SMTP server hostname. | `smtp.gmail.com` for Gmail |
| `SMTP_PORT` | SMTP port. `587` for STARTTLS (recommended). | `587` |
| `SMTP_SECURE` | Set to `true` only for port 465 (SSL). Leave `false` for port 587. | `false` |
| `SMTP_USER` | Gmail address used as sender. | The Gmail account address |
| `SMTP_PASS` | Google App Password — **not** your regular Gmail password. | Google Account → Security → 2-Step Verification → App Passwords |
| `MAIL_FROM` | Display name + address in the `From:` header. | Match `SMTP_USER`, e.g. `WorkWise <you@gmail.com>` |

#### Email — Resend (optional fallback)

| Variable | Purpose | Where to get it |
|---|---|---|
| `RESEND_API_KEY` | Resend transactional email API key. Leave empty to use SMTP instead. | [resend.com/api-keys](https://resend.com/api-keys) |
| `EMAIL_FROM` | Sender address for Resend-delivered emails. | Must be a verified domain in your Resend account |

---

### Client (`client/.env`)

Copy the template: `cp client/.env.example client/.env`

Only variables prefixed with `VITE_` are embedded into the browser bundle by Vite.

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API. Every HTTP request in `src/services/apiClient.ts` is sent to this origin. Set to your Render URL in production. | `http://localhost:3000` |

---

## Git Workflow

This project uses a **two-branch model** with `main` and `develop`.

### Branches

- **`main`** — Production-ready code. Only updated at the end of a sprint before deployment. Never push directly to main.
- **`develop`** — Active development branch. All feature work merges here first.

### How to Work on a Task

1. **Pull the latest from develop:**
   ```bash
   git checkout develop
   git pull origin develop
   ```

2. **Create a feature branch from develop:**
   ```bash
   git checkout -b feature/SCRUM-XX-short-description
   ```
   Use the Jira ticket number in the branch name (e.g., `feature/SCRUM-42-login-page`).

3. **Work on your task.** Commit often with clear messages:
   ```bash
   git add .
   git commit -m "SCRUM-42: Add login form with validation"
   ```

4. **Push your branch:**
   ```bash
   git push origin feature/SCRUM-XX-short-description
   ```

5. **Open a Pull Request (PR) into `develop`:**
   - Go to GitHub and create a PR from your branch into `develop`
   - Add a clear title and description of what you did
   - Request a review from at least one teammate
   - Link the Jira ticket in the PR description

6. **After review and approval**, merge the PR into `develop`.

7. **Delete your feature branch** after merging (GitHub can do this automatically).

### Rules

- Never push directly to `main` or `develop` — always use pull requests
- Keep your feature branches small and focused on one task
- Pull from `develop` frequently to avoid merge conflicts
- Write meaningful commit messages that reference the Jira ticket
- Review your teammates' PRs — everyone reviews, everyone learns

## Key Features

- User authentication with role-based access (Admin, Developer, Viewer)
- Project and workspace management with team invitations
- Kanban board with drag-and-drop task management
- Sprint management with backlog grooming and planning
- Real-time updates across the board via WebSockets
- Integrated documentation wiki with rich text editing
- AI Task Breakdown: paste a feature, AI splits it into subtasks
- AI Sprint Planner: suggests optimal sprint scope
- AI Daily Digest: auto-generated summary of progress and blockers
- AI Retrospective Assistant: generates structured retro reports
- Analytics dashboard with burndown charts and velocity tracking
