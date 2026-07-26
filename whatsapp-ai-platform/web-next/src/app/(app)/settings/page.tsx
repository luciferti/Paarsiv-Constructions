"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, ScrollText, Webhook } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";

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

type Tab = "keys" | "audit" | "webhooks";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("keys");
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [keyName, setKeyName] = useState("");
  const [freshSecret, setFreshSecret] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<{ keys: ApiKeyRow[] }>("/api-keys").then((r) => setKeys(r.keys)).catch(() => {});
    api.get<{ logs: AuditRow[] }>("/logs/audit").then((r) => setAudit(r.logs)).catch(() => {});
    api.get<{ logs: WebhookRow[] }>("/logs/webhooks").then((r) => setWebhooks(r.logs)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function createKey() {
    if (!keyName.trim()) return;
    const r = await api.post<{ secret: string }>("/api-keys", { name: keyName.trim() });
    setFreshSecret(r.secret);
    setKeyName("");
    load();
  }

  const TABS: { v: Tab; label: string; icon: React.ElementType }[] = [
    { v: "keys", label: "API keys", icon: KeyRound },
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
