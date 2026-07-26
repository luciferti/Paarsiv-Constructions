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

Connecting is done in the app under **Settings → WhatsApp**. No tokens are
copied by hand — Meta's Embedded Signup window handles the login, the business
selection and number verification, and the server does the rest.

### One-time: your Meta app

Create an app once at developers.facebook.com (type **Business**, product
**WhatsApp**), then:

1. **App settings → Basic** — copy the App ID and App Secret.
2. **Facebook Login for Business** — create a configuration with login variation
   *WhatsApp Embedded Signup* and copy its **Configuration ID**. The permissions
   it requests must include `whatsapp_business_management`,
   `whatsapp_business_messaging` and `business_management`.
3. **App settings → Basic → App Domains** and Facebook Login → *Valid OAuth
   redirect URIs* — add the domain the platform is served from.
4. **WhatsApp → Configuration** — set the callback URL and verify token shown on
   the Settings → WhatsApp screen, and subscribe to the `messages` field.
5. Paste the App ID, App Secret and Configuration ID into Settings → WhatsApp.

These can also be supplied server-wide via `META_APP_ID`, `META_APP_SECRET` and
`META_CONFIG_ID`; a tenant's own values win over them.

`PUBLIC_URL` must be the public origin of the API — it's what the screen shows
as the callback URL. A localhost address will never receive a webhook.

### Every connection after that

Press **Connect with Facebook**. The server then exchanges the code for a
business token, discovers the WhatsApp Business Account, subscribes this server
to its webhooks and registers the number for the Cloud API — each step reported
on screen, and any Meta error shown with its code, hint and `fbtrace_id`.

Once connected, sending stops being simulated, and **delivered / read counts
come from Meta's status webhooks** rather than being estimated. Use **Re-check**
to re-run the live checks and **Repair** if the webhook subscription is lost.

## Local development

```bash
./start.sh        # postgres + API :4000 + classic web :5173
cd web-next && npm run dev -- --port 3100   # premium UI
```
