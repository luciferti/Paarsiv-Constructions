"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, GitMerge, KeyRound, ScrollText, ShieldCheck, Webhook } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { ContactField } from "@/lib/types";

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}
interface AuditRow {
  id: string;
  action: string;
  username?: string | null;
  entity?: string | null;
  ip?: string | null;
  createdAt: string;
}
interface WebhookRow {
  id: string;
  phoneNumberId?: string | null;
  status: string;
  error?: string | null;
  createdAt: string;
}

const btnPri = "h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-8 px-3 rounded-lg border text-xs font-medium hover:bg-muted";
const inputCls = "h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";

interface MergeRules {
  phoneSuffix: boolean;
  email: boolean;
  externalId: boolean;
  nameCity: boolean;
  customFields: string[];
  survivor: "mostActive" | "oldest";
}
const DEFAULT_RULES: MergeRules = {
  phoneSuffix: true, email: true, externalId: true, nameCity: false, customFields: [], survivor: "mostActive",
};

interface ConsentRules {
  enabled: boolean;
  optOutKeywords: string[];
  optInKeywords: string[];
  optOutReply: string;
  optInReply: string;
}
const DEFAULT_CONSENT: ConsentRules = {
  enabled: true,
  optOutKeywords: ["stop", "unsubscribe"],
  optInKeywords: ["start", "subscribe"],
  optOutReply: "",
  optInReply: "",
};

type Tab = "keys" | "merge" | "consent" | "audit" | "webhooks";

/** Comma-separated editing for a keyword list — one input, no chip fiddling. */
function KeywordInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return (
    <input
      className={clsx(inputCls, "w-full")}
      value={value.join(", ")}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
    />
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("keys");
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [keyName, setKeyName] = useState("");
  const [freshSecret, setFreshSecret] = useState<string | null>(null);
  const [rules, setRules] = useState<MergeRules>(DEFAULT_RULES);
  const [consent, setConsent] = useState<ConsentRules>(DEFAULT_CONSENT);
  const [fields, setFields] = useState<ContactField[]>([]);
  const [rulesSaved, setRulesSaved] = useState(false);
  const [consentSaved, setConsentSaved] = useState(false);

  const load = useCallback(() => {
    api.get<{ keys: ApiKeyRow[] }>("/api-keys").then((r) => setKeys(r.keys)).catch(() => {});
    api.get<{ logs: AuditRow[] }>("/logs/audit").then((r) => setAudit(r.logs)).catch(() => {});
    api.get<{ logs: WebhookRow[] }>("/logs/webhooks").then((r) => setWebhooks(r.logs)).catch(() => {});
    api.get<{ tenant: { mergeRules?: Partial<MergeRules> | null; consentRules?: Partial<ConsentRules> | null } }>("/settings")
      .then((r) => {
        setRules({ ...DEFAULT_RULES, ...(r.tenant.mergeRules || {}) });
        setConsent({ ...DEFAULT_CONSENT, ...(r.tenant.consentRules || {}) });
      }).catch(() => {});
    api.get<{ fields: ContactField[] }>("/contact-fields").then((r) => setFields(r.fields)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function saveRules() {
    await api.patch("/settings", { mergeRules: rules });
    setRulesSaved(true);
    setTimeout(() => setRulesSaved(false), 1800);
  }

  async function saveConsent() {
    await api.patch("/settings", { consentRules: consent });
    setConsentSaved(true);
    setTimeout(() => setConsentSaved(false), 1800);
  }

  async function createKey() {
    if (!keyName.trim()) return;
    const r = await api.post<{ secret: string }>("/api-keys", { name: keyName.trim() });
    setFreshSecret(r.secret);
    setKeyName("");
    load();
  }

  const TABS: { v: Tab; label: string; icon: React.ElementType }[] = [
    { v: "keys", label: "API keys", icon: KeyRound },
    { v: "merge", label: "Merge rules", icon: GitMerge },
    { v: "consent", label: "Opt-out rules", icon: ShieldCheck },
    { v: "audit", label: "Audit log", icon: ScrollText },
    { v: "webhooks", label: "Webhook logs", icon: Webhook },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 border-b bg-card/50">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">API access, audit trail and webhook activity</p>
      </div>

      <div className="px-8 pt-4 flex gap-1.5 border-b">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={clsx(
                "flex items-center gap-1.5 px-4 h-9 text-[13px] font-medium border-b-2 -mb-px",
                tab === t.v ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />{t.label}
            </button>
          );
        })}
      </div>

      <div className="p-8 max-w-5xl">
        {tab === "keys" && (
          <div className="space-y-4">
            {freshSecret && (
              <div className="rounded-xl border-2 border-primary bg-accent p-4">
                <p className="text-sm font-semibold text-accent-foreground">Copy this key now — it will not be shown again.</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 text-xs bg-background border rounded-lg px-3 py-2 break-all">{freshSecret}</code>
                  <button className={btnGhost} onClick={() => { navigator.clipboard?.writeText(freshSecret); }}>
                    <Copy className="w-3 h-3 inline mr-1" />Copy
                  </button>
                  <button className={btnPri} onClick={() => setFreshSecret(null)}>Done</button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <input className={clsx(inputCls, "w-64")} placeholder="Key name, e.g. Zapier" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
              <button className={btnPri} disabled={!keyName.trim()} onClick={createKey}>+ Create key</button>
            </div>
            <div className="rounded-xl border bg-card shadow-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wide border-b bg-muted/40">
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-3 py-3 font-medium">Key</th>
                    <th className="px-3 py-3 font-medium">Last used</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.id} className="border-b last:border-0">
                      <td className="px-5 py-3 font-medium">{k.name}</td>
                      <td className="px-3 py-3"><code className="text-xs">{k.prefix}…</code></td>
                      <td className="px-3 py-3 text-muted-foreground">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "never"}</td>
                      <td className="px-3 py-3">
                        <span className={clsx("text-[11px] px-2 py-0.5 rounded-full font-medium", k.revokedAt ? "bg-destructive/15 text-destructive" : "bg-accent text-accent-foreground")}>
                          {k.revokedAt ? "revoked" : "active"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {!k.revokedAt && <button className={btnGhost} onClick={() => api.del(`/api-keys/${k.id}`).then(load)}>Revoke</button>}
                      </td>
                    </tr>
                  ))}
                  {keys.length === 0 && <tr><td colSpan={5} className="px-5 py-5 text-muted-foreground">No API keys yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "merge" && (
          <div className="max-w-2xl space-y-4">
            <div className="rounded-xl border bg-card shadow-card p-6 space-y-4">
              <div>
                <h2 className="text-[15px] font-semibold">Duplicate detection rules</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Workspace-wide. Used by Contacts → Find duplicates.
                </p>
              </div>
              {([
                ["phoneSuffix", "Phone variants", "Same last 10 digits (with/without country code)"],
                ["email", "Email match", "Same email, case-insensitive, on different numbers"],
                ["externalId", "External CRM ID", "Same external id — always a safe signal"],
                ["nameCity", "Name + city", "Same name in the same city — risky, off by default"],
              ] as const).map(([key, label, desc]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                  <button
                    onClick={() => setRules({ ...rules, [key]: !rules[key] })}
                    className={clsx(
                      "w-10 h-6 rounded-full transition-colors relative shrink-0",
                      rules[key] ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <span className={clsx(
                      "absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all",
                      rules[key] ? "left-[18px]" : "left-0.5"
                    )} />
                  </button>
                </div>
              ))}

              <div className="pt-2 border-t">
                <div className="text-sm font-medium">Custom-field match keys</div>
                <p className="text-xs text-muted-foreground mb-2">
                  Treat contacts with the same value in these fields as duplicates (e.g. PAN, member id).
                </p>
                <div className="flex flex-wrap gap-2">
                  {fields.map((f) => {
                    const on = rules.customFields.includes(f.key);
                    return (
                      <button
                        key={f.id}
                        onClick={() => setRules({
                          ...rules,
                          customFields: on ? rules.customFields.filter((k) => k !== f.key) : [...rules.customFields, f.key],
                        })}
                        className={clsx(
                          "text-xs px-3 h-7 rounded-full border font-medium",
                          on ? "bg-accent text-accent-foreground border-primary" : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                  {fields.length === 0 && <span className="text-xs text-muted-foreground">No custom fields defined yet.</span>}
                </div>
              </div>

              <div className="pt-2 border-t">
                <div className="text-sm font-medium mb-1.5">Survivor policy</div>
                <div className="flex gap-1.5">
                  {([["mostActive", "Most active (has chat / more messages)"], ["oldest", "Oldest record"]] as const).map(([v, label]) => (
                    <button
                      key={v}
                      onClick={() => setRules({ ...rules, survivor: v })}
                      className={clsx(
                        "flex-1 h-9 rounded-lg border text-xs font-medium",
                        rules.survivor === v ? "bg-accent text-accent-foreground border-primary" : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button className={btnPri} onClick={saveRules}>Save rules</button>
                {rulesSaved && <span className="text-xs text-primary font-medium">Saved ✓</span>}
                <span className="text-xs text-muted-foreground ml-auto">Merges are always human-confirmed — never automatic.</span>
              </div>
            </div>
          </div>
        )}

        {tab === "consent" && (
          <div className="max-w-2xl space-y-4">
            <div className="rounded-xl border bg-card shadow-card p-6 space-y-5">
              <div>
                <h2 className="text-[15px] font-semibold">Opt-out handling</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When a customer asks to stop, WhatsApp expects it honoured immediately — no agent in the
                  loop. Opted-out contacts are excluded from every campaign and journey.
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={consent.enabled}
                  onChange={(e) => setConsent({ ...consent, enabled: e.target.checked })} />
                <span>
                  <span className="text-sm font-medium">Act on opt-out keywords automatically</span>
                  <span className="block text-xs text-muted-foreground">
                    Turning this off means opt-outs have to be recorded by hand on each contact.
                  </span>
                </span>
              </label>

              <div className={clsx("space-y-4", !consent.enabled && "opacity-50 pointer-events-none")}>
                <div>
                  <div className="text-sm font-medium mb-1.5">Opt-out keywords</div>
                  <KeywordInput value={consent.optOutKeywords} placeholder="stop, unsubscribe, band karo"
                    onChange={(v) => setConsent({ ...consent, optOutKeywords: v })} />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Matched when the message is the phrase, or starts with it — so &quot;don&apos;t stop sending
                    photos&quot; is left alone.
                  </p>
                </div>

                <div>
                  <div className="text-sm font-medium mb-1.5">Reply after opting out</div>
                  <textarea
                    className={clsx(inputCls, "w-full h-20 py-2 resize-none")}
                    value={consent.optOutReply}
                    onChange={(e) => setConsent({ ...consent, optOutReply: e.target.value })}
                  />
                </div>

                <div className="pt-2 border-t">
                  <div className="text-sm font-medium mb-1.5">Opt-in keywords</div>
                  <KeywordInput value={consent.optInKeywords} placeholder="start, subscribe, chalu karo"
                    onChange={(v) => setConsent({ ...consent, optInKeywords: v })} />
                </div>

                <div>
                  <div className="text-sm font-medium mb-1.5">Reply after opting back in</div>
                  <textarea
                    className={clsx(inputCls, "w-full h-20 py-2 resize-none")}
                    value={consent.optInReply}
                    onChange={(e) => setConsent({ ...consent, optInReply: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button className={btnPri} onClick={saveConsent}>Save opt-out rules</button>
                {consentSaved && <span className="text-xs text-primary font-medium">Saved ✓</span>}
                <span className="text-xs text-muted-foreground ml-auto">Every change is written to the audit log.</span>
              </div>
            </div>
          </div>
        )}

        {tab === "audit" && (
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wide border-b bg-muted/40">
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-3 py-3 font-medium">User</th>
                  <th className="px-3 py-3 font-medium">Action</th>
                  <th className="px-3 py-3 font-medium">Entity</th>
                  <th className="px-3 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="px-5 py-2.5 text-muted-foreground whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2.5 font-medium">{l.username || "—"}</td>
                    <td className="px-3 py-2.5"><code className="text-xs">{l.action}</code></td>
                    <td className="px-3 py-2.5 text-muted-foreground">{l.entity || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{l.ip || "—"}</td>
                  </tr>
                ))}
                {audit.length === 0 && <tr><td colSpan={5} className="px-5 py-5 text-muted-foreground">No audit entries yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "webhooks" && (
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wide border-b bg-muted/40">
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-3 py-3 font-medium">Phone number ID</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="px-5 py-2.5 text-muted-foreground whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2.5"><code className="text-xs">{l.phoneNumberId || "—"}</code></td>
                    <td className="px-3 py-2.5">
                      <span className={clsx("text-[11px] px-2 py-0.5 rounded-full font-medium", l.status === "processed" ? "bg-accent text-accent-foreground" : l.status === "ignored" ? "bg-muted text-muted-foreground" : "bg-destructive/15 text-destructive")}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{l.error || "—"}</td>
                  </tr>
                ))}
                {webhooks.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-5 text-muted-foreground">No webhook events yet — they appear once a real WhatsApp number is connected.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
