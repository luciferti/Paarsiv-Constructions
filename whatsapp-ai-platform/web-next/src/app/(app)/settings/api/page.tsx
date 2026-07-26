"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BookOpen, Check, Copy, KeyRound, Loader2, Plus, ShieldCheck, Trash2,
} from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}
interface ScopeGroup {
  group: string;
  items: { key: string; label: string; desc: string }[];
}

const input = "w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const btnPri = "h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-50";

function Copyable({ text, className }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className={clsx("h-7 px-2 rounded-md border text-xs hover:bg-muted shrink-0", className)}
      onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); }}
    >
      {done ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function Snippet({ title, why, code, scope }: { title: string; why: string; code: string; scope: string }) {
  return (
    <div className="rounded-xl border bg-card shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b bg-muted/30 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{title}</div>
          <div className="text-[11px] text-muted-foreground">{why}</div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-mono shrink-0">
          {scope}
        </span>
        <Copyable text={code} />
      </div>
      <pre className="p-4 text-[11.5px] leading-relaxed overflow-x-auto font-mono text-muted-foreground">
        {code}
      </pre>
    </div>
  );
}

export default function ApiPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [groups, setGroups] = useState<ScopeGroup[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Set<string>>(new Set());
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // The docs show a real host, not a placeholder people forget to replace.
  const base = typeof window === "undefined" ? "" : `${window.location.origin}/api`;

  const load = useCallback(() => {
    api.get<{ keys: ApiKeyRow[] }>("/api-keys").then((r) => setKeys(r.keys)).catch(() => {});
    api.get<{ groups: ScopeGroup[] }>("/api-keys/scopes").then((r) => setGroups(r.groups)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function create() {
    setBusy(true); setErr(null);
    try {
      const r = await api.post<{ secret: string }>("/api-keys", {
        name: name.trim(),
        scopes: scopes.size ? Array.from(scopes) : undefined,
      });
      setFresh(r.secret);
      setName(""); setScopes(new Set()); setCreating(false);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create the key.");
    } finally { setBusy(false); }
  }

  async function revoke(k: ApiKeyRow) {
    if (!confirm(`Revoke "${k.name}"? Anything using it stops working immediately.`)) return;
    await api.del(`/api-keys/${k.id}`);
    load();
  }

  const token = fresh || "wak_your_key_here";
  const examples = useMemo(() => [
    {
      title: "Add a contact",
      why: "Push someone from your own system into the audience",
      scope: "contacts.edit",
      code: `curl -X POST ${base}/contacts \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "919810000001",
    "name": "Ravi Kumar",
    "email": "ravi@example.com",
    "city": "Bengaluru",
    "tags": ["lead", "website"],
    "attributes": { "budget": "2cr" }
  }'`,
    },
    {
      title: "Create a segment",
      why: "A saved audience filter you can then send a campaign to",
      scope: "segments.manage",
      code: `curl -X POST ${base}/segments \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Bengaluru leads",
    "rules": {
      "match": "all",
      "conditions": [
        { "field": "city", "op": "equals", "value": "Bengaluru" },
        { "field": "tag",  "op": "has",    "value": "lead" }
      ]
    }
  }'`,
    },
    {
      title: "Create a template",
      why: "Submitted to Meta for approval automatically",
      scope: "templates.manage",
      code: `curl -X POST ${base}/templates \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Launch invite",
    "category": "MARKETING",
    "language": "en",
    "body": "Hi {{name}}, our {{city}} launch is this weekend.",
    "footerText": "Reply STOP to unsubscribe",
    "buttons": [{ "type": "url", "text": "See homes", "value": "https://example.com" }]
  }'`,
    },
    {
      title: "Upload media",
      why: "Images and documents for template headers",
      scope: "media.manage",
      code: `curl -X POST ${base}/assets \\
  -H "Authorization: Bearer ${token}" \\
  -F "file=@/path/to/banner.jpg"

# The response has the asset id and url — pass the id as
# headerAssetId when creating an image-header template.`,
    },
    {
      title: "Run a campaign",
      why: "Create it, then send — two calls so you can check the audience first",
      scope: "campaigns.create + campaigns.send",
      code: `# 1. create (add "scheduledAt" for later, "phoneNumberId" to pick the sender)
curl -X POST ${base}/campaigns \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Weekend launch", "templateId": "TEMPLATE_ID", "segmentId": "SEGMENT_ID" }'

# 2. send it now
curl -X POST ${base}/campaigns/CAMPAIGN_ID/send \\
  -H "Authorization: Bearer ${token}"`,
    },
    {
      title: "Create a user",
      why: "Provision agents from your HR or identity system",
      scope: "users.manage",
      code: `curl -X POST ${base}/users \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "neha",
    "displayName": "Neha Jain",
    "password": "a-long-random-password",
    "role": "SALES",
    "team": "North"
  }'`,
    },
  ], [base, token]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-16 shrink-0 border-b bg-card/60 flex items-center gap-3 px-6">
        <button onClick={() => router.push("/settings")} className="p-2 -ml-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-base font-semibold">API</h1>
          <p className="text-xs text-muted-foreground">Everything the app does, your systems can do too</p>
        </div>
        <div className="flex-1" />
        <a href="/api/docs" target="_blank" rel="noreferrer" className={btnGhost}>
          <BookOpen className="w-3.5 h-3.5 inline mr-1.5" />Full reference
        </a>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8 space-y-6">
          {err && <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</div>}

          {fresh && (
            <div className="rounded-xl border-2 border-primary bg-accent p-4">
              <p className="text-sm font-semibold text-accent-foreground">
                Copy this key now — it is never shown again.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 text-xs bg-background border rounded-lg px-3 py-2 break-all">{fresh}</code>
                <Copyable text={fresh} />
                <button className={btnPri} onClick={() => setFresh(null)}>Done</button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                The examples below are filled in with it while it&apos;s on screen.
              </p>
            </div>
          )}

          {/* ---- basics ---- */}
          <section className="rounded-xl border bg-card shadow-card p-6 space-y-4">
            <h2 className="text-sm font-semibold">Getting started</h2>
            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium text-muted-foreground">Base URL</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted/50 border rounded-lg px-3 py-2 break-all">{base}</code>
                  <Copyable text={base} />
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Authentication</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted/50 border rounded-lg px-3 py-2 break-all">
                    Authorization: Bearer wak_…
                  </code>
                  <Copyable text="Authorization: Bearer wak_" />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              A key acts inside one workspace only. Requests are limited to 600 a minute, lists are paginated
              with <code className="text-[11px]">page</code> and <code className="text-[11px]">pageSize</code>{" "}
              (max 200), and every write is written to the audit log against the key&apos;s name.
            </p>
          </section>

          {/* ---- keys ---- */}
          <section className="rounded-xl border bg-card shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b bg-muted/30 flex items-center gap-3">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex-1">Keys</span>
              {!creating && (
                <button className={btnGhost} onClick={() => setCreating(true)}>
                  <Plus className="w-3.5 h-3.5 inline mr-1" />New key
                </button>
              )}
            </div>

            {creating && (
              <div className="p-5 border-b space-y-4 bg-muted/10">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">What is it for?</label>
                  <input className={clsx(input, "mt-1.5")} value={name} placeholder="Website lead form"
                    onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">What may it do?</span>
                    <span className="text-[11px] text-muted-foreground">
                      {scopes.size === 0 ? "nothing ticked = full access" : `${scopes.size} selected`}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 mb-3">
                    Tick only what the integration needs — a key that can add contacts shouldn&apos;t be able
                    to send campaigns.
                  </p>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {groups.map((g) => (
                      <div key={g.group}>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                          {g.group}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-1.5">
                          {g.items.map((it) => (
                            <label key={it.key} className="flex items-start gap-2 text-xs cursor-pointer rounded-lg px-2 py-1.5 hover:bg-muted">
                              <input type="checkbox" className="mt-0.5" checked={scopes.has(it.key)}
                                onChange={() => setScopes((p) => {
                                  const n = new Set(p);
                                  if (n.has(it.key)) n.delete(it.key); else n.add(it.key);
                                  return n;
                                })} />
                              <span>
                                <span className="block font-medium">{it.label}</span>
                                <code className="block text-[10px] text-muted-foreground">{it.key}</code>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className={btnGhost} onClick={() => { setCreating(false); setScopes(new Set()); setName(""); }}>Cancel</button>
                  <div className="flex-1" />
                  <button className={btnPri} onClick={create} disabled={busy || !name.trim()}>
                    {busy && <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />}Create key
                  </button>
                </div>
              </div>
            )}

            <div className="divide-y">
              {keys.map((k) => (
                <div key={k.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {k.name}
                      {k.revokedAt && <span className="ml-2 text-[11px] text-destructive">revoked</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">{k.prefix}…</div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {k.scopes.length === 0 ? "full access" : `${k.scopes.length} scopes`}
                  </span>
                  <span className="text-[11px] text-muted-foreground w-28">
                    {k.lastUsedAt ? `used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "never used"}
                  </span>
                  {!k.revokedAt && (
                    <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive"
                      onClick={() => revoke(k)} title="Revoke">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {keys.length === 0 && (
                <p className="px-5 py-6 text-sm text-muted-foreground">No keys yet.</p>
              )}
            </div>
          </section>

          {/* ---- examples ---- */}
          <div>
            <h2 className="text-sm font-semibold mb-1">Common calls</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Ready to paste. Each one names the scope a key needs for it.
            </p>
            <div className="space-y-3">
              {examples.map((e) => <Snippet key={e.title} {...e} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
