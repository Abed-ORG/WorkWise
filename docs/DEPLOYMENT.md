# WorkWise Deployment Guide

This guide covers the intended production shape:

- Frontend: Vercel
- Backend: Render Web Service
- Database: Supabase PostgreSQL
- ORM: Prisma
- AI: Google Gemini
- Realtime: Socket.io on the Render backend

## 1. Prepare Supabase PostgreSQL

1. Create a Supabase project.
2. Open **Settings > Database**.
3. Copy the connection strings:
   - Transaction-mode pooler for `DATABASE_URL`
   - Session-mode or direct connection for `DIRECT_URL`
4. Keep the database password private.

Recommended values:

```env
DATABASE_URL="postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:5432/postgres"
```

Prisma uses `DATABASE_URL` at runtime and `DIRECT_URL` for migrations.

## 2. Deploy The Backend To Render

Create a Render **Web Service** from the repository.

Suggested settings:

| Setting | Value |
| --- | --- |
| Root directory | `server` |
| Runtime | Node |
| Build command | `npm install && npx prisma generate && npm run build` |
| Start command | `npm start` |
| Health check path | `/health` if the route is active |

Render provides `PORT`; do not hardcode it in production.

### Backend Environment Variables

Set these in the Render service dashboard.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Supabase transaction pooler URL. |
| `DIRECT_URL` | Yes | Supabase session/direct URL for Prisma. |
| `JWT_SECRET` | Yes | Long random secret. |
| `JWT_REFRESH_SECRET` | Yes | Long random secret, different from `JWT_SECRET`. |
| `NODE_ENV` | Yes | `production`. |
| `FRONTEND_URL` | Yes | Production Vercel URL, for example `https://workwise.vercel.app`. |
| `GEMINI_API_KEY` | Required for AI | Google AI Studio key. |
| `DAILY_DIGEST_SCHEDULER_ENABLED` | Optional | Enable only if scheduled digests should run from this service. |
| `DAILY_DIGEST_HOUR_UTC` | Optional | UTC hour for digest generation. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Required for SMTP email | Needed for reset and invitation emails. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional | Alternative/fallback email provider values. |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Optional | Only needed if direct Supabase API calls are used. |

Generate JWT secrets locally with a secure generator, then paste only into Render:

```bash
openssl rand -hex 64
```

### Prisma Migration Steps

For a first deployment or after schema changes, run migrations against production from a trusted environment:

```bash
cd server
npm install
npx prisma generate
npx prisma migrate deploy
```

`npm run db:migrate` runs `prisma migrate dev` and is intended for local development. Use `npx prisma migrate deploy` for production.

If using Render one-off jobs or shell access, run the same production migration command with the Render environment variables loaded.

## 3. Deploy The Frontend To Vercel

Create a Vercel project from the repository.

Suggested settings:

| Setting | Value |
| --- | --- |
| Root directory | `client` |
| Framework preset | Vite |
| Install command | `npm install` |
| Build command | `npm run build` |
| Output directory | `dist` |

The file [client/vercel.json](../client/vercel.json) rewrites all routes to `index.html` so React Router routes work on refresh.

### Frontend Environment Variables

Set this in Vercel project settings:

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Yes | Render backend URL, for example `https://workwise-api.onrender.com`. |

Redeploy the frontend after changing Vercel environment variables. Vite embeds `VITE_` variables at build time.

## 4. Connect Frontend And Backend

Use matching origins:

- Render `FRONTEND_URL` must equal the Vercel origin that browsers use.
- Vercel `VITE_API_BASE_URL` must equal the Render backend origin.

Example:

```env
# Render
FRONTEND_URL="https://workwise.vercel.app"

# Vercel
VITE_API_BASE_URL="https://workwise-api.onrender.com"
```

Do not add a trailing slash unless client code is known to normalize it.

## 5. Common Deployment Issues

### CORS Errors

Symptom: browser requests fail before reaching route logic.

Check:

- Render `FRONTEND_URL` exactly matches the Vercel origin.
- The frontend is calling the Render URL in `VITE_API_BASE_URL`.
- The backend service has been restarted after env changes.

### Prisma Client Not Generated

Symptom: Render build succeeds partially or runtime fails with Prisma client errors.

Fix:

```bash
npx prisma generate
```

Ensure Render build command includes `npx prisma generate`.

### Migrations Missing In Production

Symptom: API routes return database errors or AI digest/retrospective routes return storage-not-ready errors.

Fix:

```bash
cd server
npx prisma migrate deploy
npx prisma generate
```

Restart the backend after migrations.

### Supabase Pooler Problems

Symptom: connection timeouts or Prisma migration failures.

Check:

- `DATABASE_URL` uses the pooler runtime connection and includes `?pgbouncer=true` when required.
- `DIRECT_URL` uses a session/direct connection suitable for migrations.
- Supabase project is not paused.
- Database password and project ref are correct.

### Password Reset Or Invitation Email Fails

Symptom: API returns `503 Email delivery is not configured yet` or `502`.

Check:

- SMTP variables are set in Render.
- Gmail uses an App Password, not a normal account password.
- `MAIL_FROM` matches or is allowed by the SMTP provider.
- If using Resend, the sender domain is verified.

### Socket.io Does Not Connect

Symptom: realtime events do not arrive or socket connection is unauthorized.

Check:

- Client passes `auth: { token: accessToken }`.
- Token is not expired.
- Render backend URL is used for the socket origin.
- Render service is a Web Service, not a static site or serverless function.
- CORS `FRONTEND_URL` matches Vercel.

### Vercel Route Refresh Shows 404

Symptom: refreshing `/projects/...` fails.

Check:

- [client/vercel.json](../client/vercel.json) exists in the deployed client root.
- Vercel root directory is `client`.
- Rewrites point to `/index.html`.

### Environment Variable Changes Do Not Appear

Symptom: frontend still calls old API URL.

Fix:

- Redeploy Vercel after changing `VITE_API_BASE_URL`.
- Restart or redeploy Render after backend env changes.

## Deployment Checklist

- Supabase database created and connection strings copied.
- Production Prisma migrations applied with `npx prisma migrate deploy`.
- Render backend has all required server environment variables.
- Render build includes `npx prisma generate`.
- Vercel frontend has `VITE_API_BASE_URL` pointing to Render.
- Render `FRONTEND_URL` points to Vercel.
- No real secrets are committed to the repository.
- Auth, project list, task board, document pages, notifications, and AI endpoints are smoke-tested after deployment.
