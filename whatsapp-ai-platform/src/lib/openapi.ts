/**
 * Minimal OpenAPI 3 spec for the platform API — served at /api/docs.
 * Covers the main resources; kept hand-written and small on purpose.
 */
export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "WhatsApp AI Platform API",
    version: "1.0.0",
    description:
      "Multi-tenant WhatsApp business platform: inbox, contacts, segments, templates, media, campaigns, journeys, reports. Authenticate with `Authorization: Bearer <jwt>` (login) or an API key `Bearer wak_...`.",
  },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/auth/login": {
      post: {
        summary: "Sign in",
        security: [],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["tenantSlug", "username", "password"],
                properties: {
                  tenantSlug: { type: "string" },
                  username: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "token + refreshToken + user + tenant" } },
      },
    },
    "/auth/refresh": {
      post: { summary: "Rotate refresh token", security: [], responses: { "200": { description: "new token pair" } } },
    },
    "/conversations": { get: { summary: "List conversations (role-scoped)", responses: { "200": { description: "conversations[]" } } } },
    "/conversations/{id}/messages": {
      get: { summary: "Thread messages", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "messages[]" } } },
    },
    "/conversations/{id}/reply": {
      post: { summary: "Agent reply (flips to HUMAN)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "ok" } } },
    },
    "/contacts": {
      get: { summary: "List contacts (search, segmentId)", responses: { "200": { description: "contacts[] + total" } } },
      post: { summary: "Create/upsert contact", responses: { "201": { description: "contact" } } },
    },
    "/contacts/import": { post: { summary: "Bulk import (≤5000); dryRun previews without writing", responses: { "200": { description: "created, updated and skipped rows" } } } },
    "/whatsapp/status": { get: { summary: "Meta connection state + webhook details", responses: { "200": { description: "status" } } } },
    "/whatsapp/app": { patch: { summary: "One-time Meta app credentials (secret is write-only)", responses: { "200": { description: "status" } } } },
    "/whatsapp/business": { patch: { summary: "Setup wizard step 1 — business details", responses: { "200": { description: "status" } } } },
    "/whatsapp/numbers/request-code": { post: { summary: "Send a verification code to a number (SMS or VOICE)", responses: { "200": { description: "sent" } } } },
    "/whatsapp/numbers/verify-code": { post: { summary: "Confirm the code and register the number", responses: { "200": { description: "status" } } } },
    "/whatsapp/profile": {
      get: { summary: "Public WhatsApp business profile", responses: { "200": { description: "profile" } } },
      post: { summary: "Update the public profile", responses: { "200": { description: "status" } } },
    },
    "/whatsapp/oauth/start": { get: { summary: "Meta sign-in URL to redirect the browser to (signed state carries the return address)", responses: { "200": { description: "url + redirectUri" } } } },
    "/whatsapp/callback": { get: { summary: "Public — Meta returns the browser here; finishes signup and redirects back to the app", security: [], responses: { "302": { description: "redirect to /settings/whatsapp?setup=…" } } } },
    "/whatsapp/connect": { post: { summary: "Finish Embedded Signup from the popup's code", responses: { "200": { description: "status + per-step trace" }, "400": { description: "Meta error with code, hint and fbtrace_id" } } } },
    "/whatsapp/verify": { post: { summary: "Re-run live checks against Meta", responses: { "200": { description: "checks" } } } },
    "/whatsapp/repair": { post: { summary: "Re-subscribe the webhook", responses: { "200": { description: "status" } } } },
    "/whatsapp/numbers": { get: { summary: "The workspace's sending numbers, refreshed from Meta", responses: { "200": { description: "numbers" } } } },
    "/whatsapp/numbers/{phoneNumberId}": { patch: { summary: "Name a number, make it the default, or retire it", responses: { "200": { description: "numbers" } } } },
    "/conversations/numbers": { get: { summary: "Numbers with their conversation counts — powers the inbox filter", responses: { "200": { description: "numbers" } } } },
    "/whatsapp/numbers/select": { post: { summary: "Switch the sending number", responses: { "200": { description: "status" } } } },
    "/whatsapp/disconnect": { post: { summary: "Forget the token and account snapshot", responses: { "200": { description: "status" } } } },
    "/contacts/bulk": { post: { summary: "Bulk tag, opt-in/out, archive or delete a selection or a whole filter", responses: { "200": { description: "affected count" } } } },
    "/contacts/export": { get: { summary: "Export the current filter as CSV", responses: { "200": { description: "text/csv" } } } },
    "/segments": {
      get: { summary: "List segments with live counts", responses: { "200": { description: "segments[]" } } },
      post: { summary: "Create segment", responses: { "201": { description: "segment" } } },
    },
    "/segments/preview": { post: { summary: "Preview rule audience", responses: { "200": { description: "count + sample" } } } },
    "/templates": {
      get: { summary: "List templates", responses: { "200": { description: "templates[]" } } },
      post: { summary: "Create template (standard/carousel)", responses: { "201": { description: "template" } } },
    },
    "/assets": {
      get: { summary: "Media library", responses: { "200": { description: "assets[]" } } },
      post: { summary: "Upload file (multipart, field 'file')", responses: { "201": { description: "asset" } } },
    },
    "/campaigns": {
      get: { summary: "List campaigns", responses: { "200": { description: "campaigns[]" } } },
      post: { summary: "Create campaign (optional scheduledAt)", responses: { "201": { description: "campaign" } } },
    },
    "/campaigns/{id}/send": {
      post: { summary: "Send campaign now", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "sending" } } },
    },
    "/journeys": {
      get: { summary: "List journeys", responses: { "200": { description: "journeys[]" } } },
      post: { summary: "Create keyword journey", responses: { "201": { description: "journey" } } },
    },
    "/reports/overview": { get: { summary: "Audience + inbox + campaign-level report", responses: { "200": { description: "overview" } } } },
    "/api-keys": {
      get: { summary: "List API keys (admin)", responses: { "200": { description: "keys[] with their scopes" } } },
      post: { summary: "Create API key — secret returned once. Pass `scopes` to limit it; omit for full tenant access (admin)", responses: { "201": { description: "key + secret" } } },
    },
    "/api-keys/scopes": { get: { summary: "Permission catalog a key can be scoped to", responses: { "200": { description: "grouped scopes" } } } },
    "/connectors": {
      get: { summary: "Inbound integrations (Shopify, Salesforce, Zoho, ServiceNow, custom)", responses: { "200": { description: "connectors[] with their webhook URLs" } } },
      post: { summary: "Add a connector — returns the URL to give the external system", responses: { "201": { description: "connector" } } },
    },
    "/connectors/{id}/rotate": { post: { summary: "New webhook secret; the old URL stops working", responses: { "200": { description: "connector" } } } },
    "/connectors/{id}/events": { get: { summary: "Last 50 events with what each one did", responses: { "200": { description: "events[]" } } } },
    "/scripts": {
      get: { summary: "Customer-written scripts and the triggers they can use", responses: { "200": { description: "scripts[] + triggers" } } },
      post: { summary: "Create a script (starts disabled)", responses: { "201": { description: "script" } } },
    },
    "/scripts/{id}/run": { post: { summary: "Run it — send `code` to try a draft, `input` to shape what it sees", responses: { "200": { description: "status, logs, return value" } } } },
    "/scripts/{id}/runs": { get: { summary: "Last 30 runs with their output", responses: { "200": { description: "runs[]" } } } },
    "/run/{secret}": {
      post: {
        summary: "PUBLIC — runs the http-triggered script with that secret; the body arrives as input.body and the return value is the response",
        security: [],
        responses: { "200": { description: "the script's return value" } },
      },
    },
    "/external-apis": {
      get: { summary: "Registered third-party APIs and their saved requests (secrets withheld)", responses: { "200": { description: "apis[]" } } },
      post: { summary: "Register an API: base URL + how it authenticates", responses: { "201": { description: "api" } } },
    },
    "/external-apis/{id}/requests": { post: { summary: "Save a call against an API — path/body support {{tokens}}", responses: { "201": { description: "request" } } } },
    "/external-apis/requests/{requestId}/run": { post: { summary: "Run it. `contactId` fills the tokens, `dryRun` skips writing back", responses: { "200": { description: "status, timing, response, and what was saved" } } } },
    "/external-apis/requests/{requestId}/logs": { get: { summary: "Last 30 runs", responses: { "200": { description: "logs[]" } } } },
    "/event-hooks": {
      get: { summary: "Outbound subscriptions + the event catalog", responses: { "200": { description: "hooks[] + catalog" } } },
      post: { summary: "Send events to a URL of yours; omit `events` for all of them", responses: { "201": { description: "hook incl. its signing secret" } } },
    },
    "/event-hooks/{id}/test": { post: { summary: "Fire a real signed delivery so setup can be proven", responses: { "200": { description: "hook + delivery result" } } } },
    "/event-hooks/{id}/deliveries": { get: { summary: "Last 50 deliveries with status, attempts and errors", responses: { "200": { description: "deliveries[]" } } } },
    "/hooks/{secret}": {
      post: {
        summary: "PUBLIC — where external systems post. The secret in the path is the credential; the payload is mapped to a contact by connector type",
        security: [],
        responses: { "200": { description: "acknowledged; processed asynchronously" } },
      },
    },
    "/logs/audit": { get: { summary: "Audit trail (admin)", responses: { "200": { description: "logs[]" } } } },
    "/logs/webhooks": { get: { summary: "Webhook event log (admin)", responses: { "200": { description: "logs[]" } } } },
  },
} as const;
