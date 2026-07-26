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
      get: { summary: "List API keys (admin)", responses: { "200": { description: "keys[]" } } },
      post: { summary: "Create API key — secret returned once (admin)", responses: { "201": { description: "key + secret" } } },
    },
    "/logs/audit": { get: { summary: "Audit trail (admin)", responses: { "200": { description: "logs[]" } } } },
    "/logs/webhooks": { get: { summary: "Webhook event log (admin)", responses: { "200": { description: "logs[]" } } } },
  },
} as const;
