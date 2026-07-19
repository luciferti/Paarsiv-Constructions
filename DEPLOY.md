# Deploying HRMS AI-OS (Render + Vercel)

The repo deploys as two pieces:

- **Backend** (FastAPI + Postgres) → **Render**, defined by `render.yaml`
- **Frontend** (Next.js) → **Vercel**

Everything below is a one-time setup (~15 minutes). After it, every
`git push` redeploys both automatically.

---

## 0. Push the repo to GitHub

```bash
# from the repo root (this folder)
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

(Create the empty repo on github.com first: New repository → no README.)

## 1. Backend on Render

1. Sign up / log in at https://render.com (use "Sign in with GitHub").
2. **New → Blueprint** → select your GitHub repo → **Apply**.
   Render reads `render.yaml` and creates:
   - `hrms-db` — free Postgres database
   - `hrms-backend` — the FastAPI service (with a generated `JWT_SECRET_KEY`)
3. Watch the first deploy's logs. You should see `alembic upgrade head`
   run all migrations (`20260714_0000` … `20260714_0008`), then uvicorn
   start. If a migration fails, the log will say exactly which one.
4. When it's live, note the URL, e.g. `https://hrms-backend-xxxx.onrender.com`.
   Check `https://<that-url>/health` returns `{"status":"ok"}`.

## 2. Frontend on Vercel

1. Sign up / log in at https://vercel.com (GitHub sign-in).
2. **Add New → Project** → import the same repo.
3. **Root Directory: `frontend`** (important — it's a monorepo).
4. Environment variable:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://<your-render-url>/api/v1`
5. **Deploy.** Note your production URL, e.g. `https://your-app.vercel.app`.

## 3. Connect them (CORS)

1. Render → `hrms-backend` → **Environment** → set
   `FRONTEND_ORIGIN` = `https://your-app.vercel.app` (no trailing slash).
2. Save — Render redeploys automatically.

## 4. First login

Open the Vercel URL → **Sign up** → company + your email + password.
That creates your organization and admin account. Everyone who signs up
gets their own isolated organization; invite-your-team flows can come later.

---

## Optional integrations (Render → Environment)

| Variable | Unlocks |
|---|---|
| `OPENAI_API_KEY` | GPT-backed AI daily summaries + free-form assistant chat (any language) |
| `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_WHATSAPP_FROM` | Real outbound WhatsApp sending |
| `WHATSAPP_DEFAULT_ORG_ID` | Inbound WhatsApp bot (set to your org id from the `organizations` table) |

For the inbound WhatsApp bot, also point your Twilio WhatsApp number's
*"when a message comes in"* webhook at
`https://<your-render-url>/api/v1/whatsapp/webhook`.

## Known free-tier limits

- **Cold starts**: Render free services sleep when idle; the first
  request after a quiet period takes ~30–60s. Upgrade the plan to avoid.
- **Uploaded invoice files are ephemeral**: they disappear on redeploy.
  For durable files, implement S3 in
  `backend/app/modules/invoice/services/file_storage.py` (marked TODO).
- **Postgres free tier expires after 90 days** on Render — upgrade or
  export before then.

## Production TODOs already marked in code

- Granular roles/permissions (`app/core/deps.py`, TODO(rbac))
- Twilio webhook signature validation (`whatsapp_webhook_routes.py`)
- Real OCR via PaddleOCR (`invoice/services/ocr_provider.py`)
