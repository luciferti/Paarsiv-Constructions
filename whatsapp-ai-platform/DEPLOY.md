# Deploying the WhatsApp AI Platform

Two apps + one database:

| Piece | Path | Port | Tech |
|---|---|---|---|
| API + Socket.IO | `.` (root) | 4000 | Express + Prisma |
| Web (premium UI) | `web-next/` | 3100 | Next.js 14 |
| Database | — | 5432 | PostgreSQL 16 |

## Option A — Docker Compose (any VPS)

> Note: written and reviewed but **not yet run** on the dev machine (no Docker
> installed there). Expect to smoke-test on first use.

```bash
cd whatsapp-ai-platform
JWT_SECRET="$(openssl rand -hex 32)" docker compose up -d --build
```

- Web: http://SERVER:3100 · API: http://SERVER:4000 · docs at `/api/docs`
- First run applies all Prisma migrations automatically (`migrate deploy`).
- Seed demo data (optional): `docker compose exec api npx prisma db seed`
  (or run `npm run seed` locally against the same DATABASE_URL).
- Uploaded media persists in the `uploads` volume; Postgres in `pgdata`.

Set in production:
- `JWT_SECRET` — long random string (required)
- `WEB_ORIGIN` — comma-separated allowed origins, e.g. `https://app.example.com`
- `NEXT_PUBLIC_SOCKET_URL` (web build arg/env) — e.g. `https://api.example.com`
  when the API is not on the same host:4000 as the web app.

## Option B — Render + Vercel (no server to manage)

1. **Postgres**: create a Render PostgreSQL instance → copy `DATABASE_URL`.
2. **API on Render**: new Web Service from this repo, root `whatsapp-ai-platform`:
   - Build: `npm ci && npx prisma generate && npx tsc -p tsconfig.json`
   - Start: `npx prisma migrate deploy && node dist/server.js`
   - Env: `DATABASE_URL`, `JWT_SECRET`, `WEB_ORIGIN=https://<your-vercel-app>`
3. **Web on Vercel**: import repo, root `whatsapp-ai-platform/web-next`:
   - Env: `API_URL=https://<render-api-url>`,
     `NEXT_PUBLIC_SOCKET_URL=https://<render-api-url>`
4. Open the Vercel URL → sign in (`demo` workspace after seeding).

## Connecting a real WhatsApp number (Meta Cloud API)

1. In Meta Business, onboard the number to your app; note the
   **Phone Number ID** and create a **System User token**.
2. Point the app's webhook to `https://<api-host>/api/webhook`,
   verify token = the tenant's `verifyToken`.
3. In the platform: AI Control → Configuration (or PATCH `/api/settings`) set
   `phoneNumberId`, `whatsappToken`, `verifyToken`.
4. Inbound messages now hit the webhook (visible in Settings → Webhook logs);
   outbound switches from simulated to real sends automatically.

## Local development

```bash
./start.sh        # postgres + API :4000 + classic web :5173
cd web-next && npm run dev -- --port 3100   # premium UI
```
