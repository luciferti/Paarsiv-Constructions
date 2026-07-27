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

Connecting is done in the app under **Settings → WhatsApp**, as a five-step
wizard: business details → connect Meta → phone number → public profile →
finish. No tokens are copied by hand.

### Who supplies the Meta app

Set `META_APP_ID`, `META_APP_SECRET` and `META_CONFIG_ID` on the server and the
platform itself is the tech provider: every workspace just presses **Continue
with Facebook** and never sees an App ID or secret — the same experience SFMC or
Interakt give their customers. Leave them unset and each workspace supplies its
own app in the wizard's Advanced panel instead.

### One-time: the Meta app

Create an app once at developers.facebook.com (type **Business**, product
**WhatsApp**), then:

1. **App settings → Basic** — copy the App ID and App Secret.
2. **Facebook Login for Business** — create a configuration with login variation
   *WhatsApp Embedded Signup* and copy its **Configuration ID**. The permissions
   it requests must include `whatsapp_business_management`,
   `whatsapp_business_messaging` and `business_management`.
3. Facebook Login → **Valid OAuth Redirect URIs** — add
   `PUBLIC_URL/api/whatsapp/callback` exactly. This is the address Meta returns
   the browser to, and the token exchange sends the same value, so a mismatch
   fails the connection.
4. **WhatsApp → Configuration** — set the callback URL and verify token shown on
   the Settings → WhatsApp screen, and subscribe to the `messages` field.
5. Paste the App ID, App Secret and Configuration ID into Settings → WhatsApp.

These can also be supplied server-wide via `META_APP_ID`, `META_APP_SECRET` and
`META_CONFIG_ID`; a tenant's own values win over them.

`PUBLIC_URL` must be the public origin of the API — it's what the screen shows
as the callback URL. A localhost address will never receive a webhook.

### The wizard

1. **Business details** — legal name, category, country, email, website, address.
   Stored locally and used to pre-fill the WhatsApp profile later.
2. **Connect Meta** — the browser is sent to facebook.com, where sign-in, the
   business portfolio and creating the WhatsApp Business Account all happen.
   Meta then returns the browser to `PUBLIC_URL/api/whatsapp/callback`, which
   exchanges the code for a business token, discovers the account, subscribes
   this server to its webhooks, registers the number, and finally sends the
   browser back to the wizard with the step-by-step trace.
3. **Phone number** — every number on the account with its verification state and
   quality rating. Unverified numbers get a code by SMS or voice call, entered
   right there; then the number is registered for sending.
4. **Public profile** — the about line, description, address, email, website and
   category customers see, pre-filled from step 1.
5. **Finish** — portfolio verification, account review status, number quality and
   webhook state, with Re-check and Repair.

Any Meta error is shown with its message, code, hint and `fbtrace_id`.

Once connected, sending stops being simulated, and **delivered / read counts
come from Meta's status webhooks** rather than being estimated. Use **Re-check**
to re-run the live checks and **Repair** if the webhook subscription is lost.

## Local development

```bash
./start.sh        # postgres + API :4000 + classic web :5173
cd web-next && npm run dev -- --port 3100   # premium UI
```

## Integrations and the API

### Connectors (data in)

**Settings → Integrations → Connectors.** Each connector is an inbound webhook
URL with a long secret in the path. Shopify, Salesforce, Zoho CRM and
ServiceNow payloads are mapped to contacts automatically; anything else uses the
**Custom** connector and our own JSON shape:

```json
{ "phone": "919810000001", "name": "Ravi", "email": "ravi@example.com",
  "tags": ["lead"], "attributes": { "plan": "gold" } }
```

A contact that already exists is filled in, never overwritten — an agent's
edits win. A payload with no usable phone number is recorded as a skipped
event with the reason, not silently dropped. Every connector shows its last 50
events, and the secret can be rotated (the old URL dies immediately) or the
whole connector paused.

For a deeper integration than "post JSON at a URL" — two-way sync, OAuth apps,
a product not in the list — customers are pointed at the support team.

### Event webhooks (data out)

The other direction, on the same screen. Subscribe a URL of yours to any of:
`message.received`, `message.sent`, `conversation.handoff`, `contact.created`,
`contact.opted_out`, `contact.opted_in`, `campaign.finished` — or leave the list
empty for all of them.

Every request carries the event body plus three headers:

```
X-Event: message.received
X-Timestamp: 1769500000000
X-Signature: sha256=<hmac>
```

Verify it by recomputing `HMAC-SHA256(secret, "{timestamp}.{rawBody}")` and
comparing. Delivery is fire-and-forget — nothing in the messaging path waits on
your server — and each event is tried up to three times with a short backoff.
Ten consecutive failures pause the endpoint rather than retrying a dead host
forever; switching it back on clears the streak. The last fifty deliveries are
listed with their status code, attempt count and error, and **Test** sends a
real signed request down the same path so setup can be proven before anything
depends on it.

### Developer console (calling somebody else's API)

Connectors and event webhooks both wait for something to happen. The console
is for when the platform needs to **ask** — look up a loan status mid-chat,
check stock, raise a ticket.

**Settings → Integrations → Developer console.** Register an API once (base URL
plus how it authenticates: an API key header, a bearer token, or basic), then
save named calls against it. A call's path and body can carry `{{tokens}}` —
`{{name}}`, `{{phone}}`, any custom field — filled from the contact it runs for,
and a response-mapping like `{ "data.status": "loan_status" }` copies pieces of
the answer back onto that contact.

**Send** runs it live and shows the status, timing, exactly what was sent, the
raw response and what got written back. **Dry run** does the same without
touching the contact. Then drop a **Call an API** block into a journey, pick the
saved call, and a Condition block further down can branch on whatever it wrote.

Secrets are stored server-side and never returned to the browser. Requests to
private and loopback addresses are refused, so a saved call can't be pointed at
the infrastructure the platform runs on.

### Scripts (your own code)

The console covers "call this URL". Scripts cover everything around it: read
from two places, decide what it means, message the customer, save the answer.

**Settings → Integrations → Scripts.** Plain JavaScript with a small SDK —
`input`, `log()`, `http.get/post`, `whatsapp.send`, `contacts.find/update/tag` —
and `return` whatever you want recorded. A script runs when a customer messages,
when a contact appears, when a campaign finishes, on a URL you POST to, or when
you press Run. The editor runs what is on screen, not what was last saved, and
shows the output, the return value and the run history.

Limits: ten seconds per run, twenty HTTP calls, no `require`, and private or
loopback addresses are refused. To be clear about what that is and isn't — the
sandbox stops an accidental infinite loop or a runaway fetch from hurting the
server. It is **not** a boundary against the person writing the script, who
already holds workspace-admin rights. Keep `settings.manage` to people you'd
trust with a shell.

### API (everything out and in)

**Settings → Integrations → API** has the base URL, the auth header, key
management and ready-to-paste calls for adding contacts, creating segments and
templates, uploading media, running campaigns and creating users. The full
reference is at `/api/docs`.

Keys authenticate as `Authorization: Bearer wak_…` and are scoped:

- **No scopes** → full access to that workspace.
- **Scopes set** → the key may only do exactly those, even though it
  authenticates as an admin. A key for a website lead form should hold
  `contacts.edit` and nothing else.

Every read endpoint is permission-checked too, so a scoped key can't wander
into reports or the inbox. Writes are attributed to the key's name in the audit
log.

## Sending at scale

### What the numbers actually are

Measured on this codebase against 50,000 contacts, sends simulated (no live
number), Postgres on the same machine:

| | |
|---|---|
| 50,000 messages | **51 seconds** end to end |
| Memory during the send | flat — the audience is never loaded at once |
| Pause → resume | stops within one page, resumes from the cursor |
| Killed mid-send, restarted | resumed automatically, **0 duplicates** out of 50,000 |

The database is not the limit. **Meta is.** Two separate ceilings apply:

- **Throughput** — the Cloud API accepts about 80 messages a second by default,
  raisable to 1,000 on request. A campaign's `rateLimit` (default 20/s) paces us
  under it, because a rejected message still counts as an attempt.
- **Daily unique recipients** — the number's messaging tier: 1K, 10K, 100K or
  unlimited per rolling 24 hours. This is the one that decides whether 30 lakh
  is possible at all.

So at 80/s, 1 lakh takes about 21 minutes of wall clock and 30 lakh about
10 hours — *if* the number is on the unlimited tier. On a 100K-tier number,
30 lakh is a month of sending regardless of how fast the server is.

The campaign screen says this before you press send, rather than after.

### How it survives a long send

- The audience is walked in pages of 500 by id, so a list of any size costs the
  same memory as a small one.
- Each page goes through a worker pool of 16 under a token bucket.
- After every page the cursor and the counters are written. That row is the
  resume point.
- `(campaignId, contactId)` is unique, so resuming after a crash **cannot**
  message anyone a second time.
- On boot, any campaign left in `SENDING` is picked up and continued — a deploy
  mid-send is no longer fatal.
- Pause, resume and cancel are available throughout, with live progress and a
  running estimate.

Journeys enrol segments the same way, in pages — the old 5,000-contact cap is
gone.

### What is still single-process

Sending runs inside the API process. That is fine to the limits above, since
Meta's own rate is the bottleneck long before Node is. If you ever need several
numbers sending large campaigns at once, move `runCampaign` behind a real queue
(BullMQ/Redis) — the function is already resumable and idempotent, so it can be
lifted out without changing its behaviour.
