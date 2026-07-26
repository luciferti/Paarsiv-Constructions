"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, Copy, LifeBuoy, Loader2, Plug, Plus, RefreshCw, Trash2,
} from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";

interface Connector {
  id: string;
  type: string;
  name: string;
  url: string;
  active: boolean;
  config?: { tag?: string; optInDefault?: boolean } | null;
  eventsReceived: number;
  contactsUpserted: number;
  lastEventAt?: string | null;
  lastError?: string | null;
}
interface ConnectorEvent {
  id: string; status: string; summary?: string | null; error?: string | null; createdAt: string;
}

/** What each integration sends us, and where the customer sets it up. */
const CATALOG = [
  {
    type: "shopify", name: "Shopify",
    blurb: "Customers and orders become contacts, tagged with what they bought.",
    setup: "Shopify admin → Settings → Notifications → Webhooks → add a webhook for Order creation or Customer creation, format JSON, and paste the URL below.",
  },
  {
    type: "salesforce", name: "Salesforce",
    blurb: "Leads and contacts flow in as soon as they're created or updated.",
    setup: "Setup → Flows → new Record-Triggered flow on Lead or Contact → HTTP Callout action posting the record as JSON to the URL below.",
  },
  {
    type: "zoho", name: "Zoho CRM",
    blurb: "Leads and contacts from your Zoho workflows.",
    setup: "Zoho CRM → Setup → Automation → Workflow Rules → Actions → Webhooks. Method POST, format JSON, URL below.",
  },
  {
    type: "servicenow", name: "ServiceNow",
    blurb: "Callers and ticket details, so support can reach people on WhatsApp.",
    setup: "System Web Services → REST Messages, or a Business Rule that posts the record as JSON to the URL below.",
  },
  {
    type: "custom", name: "Custom",
    blurb: "Anything else — send our own simple JSON shape.",
    setup: 'POST { "phone": "9198…", "name": "…", "email": "…", "tags": ["…"], "attributes": { "plan": "gold" } } to the URL below.',
  },
] as const;

const input = "w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const btnPri = "h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-50";

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="h-8 px-2.5 rounded-md border text-xs hover:bg-muted shrink-0"
      onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); }}>
      {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function ConnectorsPage() {
  const router = useRouter();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [events, setEvents] = useState<Record<string, ConnectorEvent[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", tag: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<{ connectors: Connector[] }>("/connectors")
      .then((r) => setConnectors(r.connectors)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function create(type: string) {
    setBusy(true); setErr(null);
    try {
      await api.post("/connectors", {
        type,
        name: form.name.trim() || CATALOG.find((c) => c.type === type)?.name || type,
        config: form.tag.trim() ? { tag: form.tag.trim() } : undefined,
      });
      setAdding(null); setForm({ name: "", tag: "" });
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add that connector.");
    } finally { setBusy(false); }
  }

  async function toggle(c: Connector) {
    await api.patch(`/connectors/${c.id}`, { active: !c.active });
    load();
  }

  async function rotate(c: Connector) {
    if (!confirm("Generate a new URL? The current one stops working straight away.")) return;
    await api.post(`/connectors/${c.id}/rotate`);
    load();
  }

  async function remove(c: Connector) {
    if (!confirm(`Delete "${c.name}"? Its history goes too.`)) return;
    await api.del(`/connectors/${c.id}`);
    load();
  }

  async function openEvents(c: Connector) {
    if (openId === c.id) { setOpenId(null); return; }
    setOpenId(c.id);
    const r = await api.get<{ events: ConnectorEvent[] }>(`/connectors/${c.id}/events`);
    setEvents((p) => ({ ...p, [c.id]: r.events }));
    load(); // counters move while the page is open — keep them honest
  }

  const installed = new Set(connectors.map((c) => c.type));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-16 shrink-0 border-b bg-card/60 flex items-center gap-3 px-6">
        <button onClick={() => router.push("/settings")} className="p-2 -ml-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-base font-semibold">Connectors</h1>
          <p className="text-xs text-muted-foreground">Bring people in from the systems you already run</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8 space-y-6">
          {err && <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</div>}

          {/* installed */}
          {connectors.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Connected</h2>
              {connectors.map((c) => {
                const meta = CATALOG.find((x) => x.type === c.type);
                return (
                  <div key={c.id} className="rounded-xl border bg-card shadow-card overflow-hidden">
                    <div className="px-5 py-4 flex items-start gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{c.name}</span>
                          <span className="text-[10px] px-1.5 py-px rounded bg-muted text-muted-foreground uppercase">{c.type}</span>
                          {!c.active && <span className="text-[10px] px-1.5 py-px rounded bg-warning/15 text-warning">paused</span>}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {c.eventsReceived} events · {c.contactsUpserted} contacts
                          {c.lastEventAt ? ` · last ${new Date(c.lastEventAt).toLocaleString()}` : " · nothing yet"}
                        </p>
                        {c.lastError && <p className="text-[11px] text-destructive mt-1">Last problem: {c.lastError}</p>}
                      </div>
                      <button className={btnGhost} onClick={() => openEvents(c)}>
                        {openId === c.id ? "Hide activity" : "Activity"}
                      </button>
                      <button className={btnGhost} onClick={() => toggle(c)}>{c.active ? "Pause" : "Resume"}</button>
                      <button className={btnGhost} onClick={() => rotate(c)} title="New URL">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button className="h-9 px-3 rounded-lg border text-muted-foreground hover:text-destructive hover:bg-muted"
                        onClick={() => remove(c)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="px-5 pb-4 space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Webhook URL</div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-[11px] bg-muted/50 border rounded-lg px-3 py-2 break-all">{c.url}</code>
                        <CopyBtn text={c.url} />
                      </div>
                      {meta && <p className="text-[11px] text-muted-foreground leading-relaxed">{meta.setup}</p>}
                    </div>

                    {openId === c.id && (
                      <div className="border-t divide-y max-h-72 overflow-y-auto">
                        {(events[c.id] || []).map((e) => (
                          <div key={e.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
                            <span className={clsx(
                              "text-[10px] px-1.5 py-px rounded font-medium shrink-0",
                              e.status === "processed" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                            )}>{e.status}</span>
                            <span className="flex-1 truncate">{e.summary || e.error}</span>
                            <span className="text-muted-foreground shrink-0">{new Date(e.createdAt).toLocaleTimeString()}</span>
                          </div>
                        ))}
                        {(events[c.id] || []).length === 0 && (
                          <p className="px-5 py-4 text-xs text-muted-foreground">Nothing received yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {/* catalog */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">{connectors.length ? "Add another" : "Available"}</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {CATALOG.map((c) => (
                <div key={c.type} className="rounded-xl border bg-card shadow-card p-4">
                  <div className="flex items-center gap-2">
                    <Plug className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold flex-1">{c.name}</span>
                    {installed.has(c.type) && <Check className="w-3.5 h-3.5 text-success" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{c.blurb}</p>

                  {adding === c.type ? (
                    <div className="mt-3 space-y-2">
                      <input className={input} placeholder={`Name it — e.g. ${c.name} (live)`}
                        value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                      <input className={input} placeholder="Tag everyone it brings in (optional)"
                        value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} />
                      <div className="flex gap-2">
                        <button className={btnGhost} onClick={() => setAdding(null)}>Cancel</button>
                        <div className="flex-1" />
                        <button className={btnPri} onClick={() => create(c.type)} disabled={busy}>
                          {busy && <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />}Add
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button className={clsx(btnGhost, "mt-3")} onClick={() => { setAdding(c.type); setForm({ name: "", tag: "" }); }}>
                      <Plus className="w-3.5 h-3.5 inline mr-1" />Add
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* anything else */}
          <section className="rounded-xl border border-dashed p-5 flex items-start gap-3">
            <LifeBuoy className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-medium">Need a connector that isn&apos;t here?</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                If your system can post JSON to a URL, the <span className="font-medium">Custom</span> connector
                above already covers it. For anything deeper — a two-way sync, an OAuth app, a product we
                don&apos;t list — talk to the support team and we&apos;ll build it with you.
              </p>
              <a href="mailto:support@example.com?subject=Custom%20connector%20request"
                className={clsx(btnGhost, "mt-3 inline-flex items-center")}>
                Contact support
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
