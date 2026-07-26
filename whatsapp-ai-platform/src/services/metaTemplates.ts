import type { Tenant, Template } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { extractTokens } from "../lib/tokens";

const GRAPH = "https://graph.facebook.com";

export interface MetaSubmitResult {
  ok: boolean;
  metaId?: string;
  status?: string;
  category?: string;
  error?: string;
  skipped?: boolean; // no Meta credentials configured
}

interface TemplateButton { type: "quick_reply" | "url" | "phone"; text: string; value?: string }

/** Meta requires lowercase snake_case template names. */
export function metaName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}

/**
 * Meta only supports positional variables ({{1}}, {{2}}). We author with named
 * tokens ({{name}}), so convert and return sample values for the example block.
 */
export function toPositional(body: string): { text: string; tokens: string[] } {
  const tokens = extractTokens(body);
  let text = body;
  tokens.forEach((t, i) => {
    text = text.replace(new RegExp(`\\{\\{\\s*${t}\\s*\\}\\}`, "gi"), `{{${i + 1}}}`);
  });
  return { text, tokens };
}

const SAMPLES: Record<string, string> = {
  name: "Ravi", city: "Bengaluru", phone: "919876543210", email: "ravi@example.com",
};

/** Build the Meta `components` array from our template model. */
export function buildComponents(t: Template): object[] {
  const components: object[] = [];

  if (t.headerType === "text" && t.headerText) {
    components.push({ type: "HEADER", format: "TEXT", text: t.headerText });
  } else if (["image", "video", "document"].includes(t.headerType)) {
    // Media headers need a resumable-upload handle; we submit the format and
    // let Meta ask for the sample if required by the account.
    components.push({ type: "HEADER", format: t.headerType.toUpperCase() });
  }

  const { text, tokens } = toPositional(t.body);
  const bodyComp: Record<string, unknown> = { type: "BODY", text };
  if (tokens.length) {
    bodyComp.example = { body_text: [tokens.map((tk) => SAMPLES[tk] || "sample")] };
  }
  components.push(bodyComp);

  if (t.footerText) components.push({ type: "FOOTER", text: t.footerText });

  const buttons = (t.buttons as unknown as TemplateButton[]) || [];
  if (buttons.length) {
    components.push({
      type: "BUTTONS",
      buttons: buttons.map((b) =>
        b.type === "url"
          ? { type: "URL", text: b.text, url: b.value || "https://example.com" }
          : b.type === "phone"
            ? { type: "PHONE_NUMBER", text: b.text, phone_number: b.value || "+910000000000" }
            : { type: "QUICK_REPLY", text: b.text }
      ),
    });
  }

  return components;
}

/** Submit a template to Meta for approval. No-ops (skipped) without creds. */
export async function submitToMeta(tenant: Tenant, template: Template): Promise<MetaSubmitResult> {
  if (!tenant.wabaId || !tenant.whatsappToken) {
    return { ok: false, skipped: true, error: "WhatsApp Business Account not connected" };
  }
  const version = tenant.graphVersion || "v21.0";
  const url = `${GRAPH}/${version}/${tenant.wabaId}/message_templates`;
  const payload = {
    name: metaName(template.name),
    language: template.language || "en",
    category: template.category || "MARKETING",
    components: buildComponents(template),
  };

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${tenant.whatsappToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await resp.json()) as {
      id?: string; status?: string; category?: string; error?: { message?: string };
    };
    if (!resp.ok) {
      return { ok: false, error: data?.error?.message || `HTTP ${resp.status}` };
    }
    return { ok: true, metaId: data.id, status: data.status || "PENDING", category: data.category };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
}

/**
 * Pull template statuses from Meta and update local rows (matched by metaId,
 * else by the normalized name). Returns how many rows changed.
 */
export async function syncFromMeta(tenant: Tenant): Promise<{ ok: boolean; updated: number; error?: string }> {
  if (!tenant.wabaId || !tenant.whatsappToken) {
    return { ok: false, updated: 0, error: "WhatsApp Business Account not connected" };
  }
  const version = tenant.graphVersion || "v21.0";
  const url = `${GRAPH}/${version}/${tenant.wabaId}/message_templates?fields=id,name,status,category,rejected_reason&limit=200`;

  try {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${tenant.whatsappToken}` } });
    const data = (await resp.json()) as {
      data?: { id: string; name: string; status: string; category?: string; rejected_reason?: string }[];
      error?: { message?: string };
    };
    if (!resp.ok) return { ok: false, updated: 0, error: data?.error?.message || `HTTP ${resp.status}` };

    const locals = await prisma.template.findMany({ where: { tenantId: tenant.id } });
    let updated = 0;
    for (const remote of data.data || []) {
      const local =
        locals.find((l) => l.metaId === remote.id) ||
        locals.find((l) => metaName(l.name) === remote.name);
      if (!local) continue;
      await prisma.template.update({
        where: { id: local.id },
        data: {
          metaId: remote.id,
          metaStatus: remote.status,
          metaCategory: remote.category ?? null,
          metaError: remote.rejected_reason || null,
          syncedAt: new Date(),
        },
      });
      updated++;
    }
    return { ok: true, updated };
  } catch (e) {
    return { ok: false, updated: 0, error: e instanceof Error ? e.message : "network error" };
  }
}

/** Delete a template on Meta (by name, as the Graph API expects). */
export async function deleteOnMeta(tenant: Tenant, template: Template): Promise<void> {
  if (!tenant.wabaId || !tenant.whatsappToken || !template.metaId) return;
  const version = tenant.graphVersion || "v21.0";
  const url = `${GRAPH}/${version}/${tenant.wabaId}/message_templates?name=${encodeURIComponent(metaName(template.name))}`;
  try {
    await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${tenant.whatsappToken}` } });
  } catch {
    /* best effort — local delete still proceeds */
  }
}
