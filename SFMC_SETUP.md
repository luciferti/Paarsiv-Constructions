# SFMC (Salesforce Marketing Cloud) — Email & WhatsApp setup

The HRMS talks to SFMC through one OAuth2 (server-to-server) app for both
**Email** and **WhatsApp**. Everything is config-driven: with no SFMC env vars
set, email/WhatsApp fall back to an in-app "logged" state, so nothing breaks.
Once you set the variables below in **Render → hrms-backend → Environment**,
SFMC takes over automatically.

> Set every secret in Render's Environment tab. Never paste client secrets into
> chat or commit them.

---

## 1. Create the API integration (gets you 3 core values)

In SFMC: **Setup → Platform Tools → Apps → Installed Packages → New**.
Add an **API Integration** component, type **Server-to-Server**.

Grant scopes:
- Email: **Email (Read, Write, Send)**, **Web (Read, Write)**
- WhatsApp: **Messaging (Read, Write, Send)** / GroupConnect as applicable

From the package you get:
| Value | Env var |
|-------|---------|
| Subdomain (the `mcXXXX...` in the Auth Base URI) | `SFMC_SUBDOMAIN` |
| Client Id | `SFMC_CLIENT_ID` |
| Client Secret | `SFMC_CLIENT_SECRET` |
| MID (optional, specific business unit) | `SFMC_ACCOUNT_ID` |

The app authenticates against
`https://<SFMC_SUBDOMAIN>.auth.marketingcloudapis.com/v2/token` and uses the
`rest_instance_url` from the token response for all calls — no other base URL
config needed.

---

## 2. Email (transactional)

1. Create an **email asset** in Content Builder. Put `%%subject%%` in the
   subject line and `%%body%%` where the message text should render.
2. Create a **Transactional Send Definition** bound to that asset
   (Email Studio → transactional messaging, or via API). Note its **key**.
3. Set:
   - `SFMC_EMAIL_DEFINITION_KEY=<that key>`
   - `SFMC_FROM_EMAIL`, `SFMC_FROM_NAME` (sender identity)

The app sends via `POST /messaging/v1/email/messages/{messageKey}` with
`definitionKey` + a `recipient` whose `attributes` carry `subject` and `body`.
If your asset uses different attribute names, tweak `_send_via_sfmc` in
`backend/app/modules/email/services/email_provider.py`.

**Verify it live:** as a logged-in admin, `POST /api/v1/messaging/email/test`
with `{ "to_email": "you@x.com" }`. `GET /api/v1/messaging/status` shows which
provider is active and whether SFMC is configured.

---

## 3. WhatsApp

**Outbound** — set `SFMC_WHATSAPP_DEFINITION_KEY` to your WhatsApp channel's
message definition key. The app sends via
`POST /messaging/v1/messageDefinitionSends/key:{key}/send`. (If your SFMC
WhatsApp channel uses a different endpoint, that one method is the only thing to
change: `SFMCWhatsAppProvider.send` in
`backend/app/modules/notification/services/whatsapp_provider.py`.)

**Inbound (two-way bot)** — point your SFMC WhatsApp inbound event/webhook at:

```
POST https://hrms-backend-nr4l.onrender.com/api/v1/whatsapp/webhook
```

The webhook accepts SFMC JSON (it reads the sender from `mobileNumber`/`from`/
`msisdn`/`contactKey` and the text from `messageText`/`message`/`body`/`text`,
including a nested `messages[]` envelope) and replies with
`{ "reply": "...", "to": "<sender>" }`. It also still accepts Twilio's form
format. Also set `WHATSAPP_DEFAULT_ORG_ID` to the org the bot should answer for.

> If your SFMC inbound payload differs, send one sample body and the parser
> (`_parse_sfmc_payload`) can be matched to it exactly.

---

## 4. Provider selection

`MESSAGING_PROVIDER` controls routing (default `auto`):
- `auto` — SFMC if configured (WhatsApp also needs its definition key), else
  Twilio if configured, else logging.
- `sfmc` / `twilio` / `logging` — force a specific provider.

---

## Quick checklist (Render env vars)

```
SFMC_SUBDOMAIN=
SFMC_CLIENT_ID=
SFMC_CLIENT_SECRET=
SFMC_EMAIL_DEFINITION_KEY=
SFMC_FROM_EMAIL=
SFMC_FROM_NAME=
SFMC_WHATSAPP_DEFINITION_KEY=
WHATSAPP_DEFAULT_ORG_ID=
MESSAGING_PROVIDER=auto
```

After saving, Render redeploys; then hit `GET /api/v1/messaging/status` to
confirm `sfmc_configured: true` and the SFMC providers are active.
