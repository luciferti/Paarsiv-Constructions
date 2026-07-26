"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Archive, Ban, Bot, Briefcase, Building2, CheckCheck, CircleCheck,
  Clock, Globe, Languages, Loader2, Mail, MapPin, MessageSquare, Pencil,
  PhoneCall, Send, Sparkles, StickyNote, Tag as TagIcon, Timer, User as UserIcon,
} from "lucide-react";
import clsx from "clsx";
import { api, getSession } from "@/lib/api";
import type { Contact, ContactField, Note } from "@/lib/types";

interface Kpis {
  totalMessages: number; incoming: number; outgoing: number;
  delivered: number; read: number; failed: number; mediaSent: number;
  aiReplies: number; agentReplies: number;
  deliveryRate: number; readRate: number; replyRate: number;
  avgResponseSec: number | null;
  firstContactAt?: string | null; lastContactAt?: string | null;
}
interface CampaignRow {
  id: string; campaignName: string; templateName?: string | null;
  status: string; sentAt?: string | null; error?: string | null;
}
interface TimelineEvent { type: string; at: string; title: string; detail?: string }
interface C360 {
  contact: Contact & {
    company?: string | null; jobTitle?: string | null; country?: string | null;
    timezone?: string | null; language?: string | null; externalId?: string | null;
    status: string; updatedAt: string;
  };
  owner?: { id: string; displayName: string } | null;
  conversation?: { id: string; mode: string; labels: string[]; assignedUser?: { displayName: string } | null } | null;
  kpis: Kpis;
  campaignHistory: CampaignRow[];
  notes: Note[];
  timeline: TimelineEvent[];
  healthScore: number;
  inactiveDays: number | null;
  fields: ContactField[];
}
interface Assist { summary: string; sentiment: string; intent: string; suggestions: string[]; engine: string }

const EVENT_META: Record<string, { icon: React.ElementType; cls: string }> = {
  message_in: { icon: MessageSquare, cls: "bg-primary/15 text-primary" },
  message_ai: { icon: Bot, cls: "bg-accent text-accent-foreground" },
  message_agent: { icon: Send, cls: "bg-success/15 text-success" },
  note: { icon: StickyNote, cls: "bg-warning/15 text-warning" },
  campaign: { icon: CheckCheck, cls: "bg-muted text-muted-foreground" },
};

function fmtDur(sec: number | null): string {
  if (sec === null) return "—";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}
function fmtDate(iso?: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "—";
}
const btnPri = "h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-8 px-3 rounded-lg border text-xs font-medium hover:bg-muted";
const inputCls = "w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";

function HealthRing({ score }: { score: number }) {
  const r = 34, c = 2 * Math.PI * r;
  const color = score >= 65 ? "hsl(var(--success))" : score >= 40 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
  return (
    <div className="relative w-24 h-24">
      <svg viewBox="0 0 84 84" className="w-24 h-24 -rotate-90">
        <circle cx="42" cy="42" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-xl font-semibold">{score}</div>
          <div className="text-[9px] text-muted-foreground -mt-0.5">/ 100</div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3.5 shadow-card">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export default function Contact360Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const session = typeof window !== "undefined" ? getSession() : null;
  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "RM";

  const [data, setData] = useState<C360 | null>(null);
  const [tab, setTab] = useState<"timeline" | "campaigns" | "notes">("timeline");
  const [assist, setAssist] = useState<Assist | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  const load = useCallback(() => {
    api.get<C360>(`/contacts/${id}/360`).then(setData).catch(() => {});
  }, [id]);
  useEffect(load, [load]);

  async function setStatus(status: string) {
    await api.patch(`/contacts/${id}`, { status });
    load();
  }
  async function analyze() {
    if (!data?.conversation || analyzing) return;
    setAnalyzing(true);
    try {
      setAssist(await api.post<Assist>("/ai/assist", { conversationId: data.conversation.id }));
    } finally { setAnalyzing(false); }
  }
  async function addNote() {
    if (!data?.conversation || !noteDraft.trim()) return;
    await api.post(`/conversations/${data.conversation.id}/notes`, { body: noteDraft.trim() });
    setNoteDraft("");
    load();
  }

  if (!data) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  const { contact: c, kpis: k } = data;

  const profileRows: { icon: React.ElementType; label: string; value?: string | null }[] = [
    { icon: PhoneCall, label: "WhatsApp", value: `+${c.phone}` },
    { icon: Mail, label: "Email", value: c.email },
    { icon: Building2, label: "Company", value: c.company },
    { icon: Briefcase, label: "Role", value: c.jobTitle },
    { icon: MapPin, label: "Location", value: [c.city, c.country].filter(Boolean).join(", ") },
    { icon: Globe, label: "Timezone", value: c.timezone },
    { icon: Languages, label: "Language", value: c.language },
    { icon: UserIcon, label: "Lead owner", value: data.owner?.displayName },
    { icon: CircleCheck, label: "Customer ID", value: c.externalId || c.id.slice(-8) },
  ];

  return (
    <div className="flex-1 flex min-h-0">
      {/* LEFT — profile rail */}
      <aside className="w-72 shrink-0 border-r bg-card overflow-y-auto">
        <div className="p-4 border-b">
          <button onClick={() => router.push("/contacts")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> Contacts
          </button>
          <div className="text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-primary/15 text-primary grid place-items-center text-2xl font-semibold">
              {(c.name || c.phone).slice(0, 2).toUpperCase()}
            </div>
            <div className="mt-3 font-semibold text-lg">{c.name || "Unknown"}</div>
            <div className="flex items-center justify-center gap-1.5 mt-1.5 flex-wrap">
              <span className={clsx(
                "text-[11px] px-2 py-0.5 rounded-full font-medium capitalize",
                c.status === "active" ? "bg-success/15 text-success" :
                c.status === "blocked" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
              )}>{c.status}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{c.source}</span>
              {c.optedIn && <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground">opted-in</span>}
            </div>
          </div>
          {/* quick actions */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            {data.conversation && (
              <button className={btnPri} onClick={() => router.push("/inbox")}>
                <MessageSquare className="w-3 h-3 inline mr-1" />Open chat
              </button>
            )}
            {canEdit && <button className={btnGhost} onClick={() => router.push(`/contacts/${id}/edit`)}><Pencil className="w-3 h-3 inline mr-1" />Edit</button>}
            {canEdit && c.status !== "blocked" && (
              <button className={btnGhost} onClick={() => setStatus("blocked")}><Ban className="w-3 h-3 inline mr-1" />Block</button>
            )}
            {canEdit && c.status !== "archived" && (
              <button className={btnGhost} onClick={() => setStatus("archived")}><Archive className="w-3 h-3 inline mr-1" />Archive</button>
            )}
            {canEdit && c.status !== "active" && (
              <button className={btnGhost} onClick={() => setStatus("active")}><CircleCheck className="w-3 h-3 inline mr-1" />Activate</button>
            )}
          </div>
        </div>

        <div className="p-4 space-y-2.5 text-sm border-b">
          {profileRows.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.label} className="flex items-center gap-2.5">
                <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground w-20 shrink-0">{r.label}</span>
                <span className="text-xs font-medium truncate">{r.value || "—"}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-2.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground w-20 shrink-0">Created</span>
            <span className="text-xs font-medium">{new Date(c.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Tags</div>
          <div className="flex flex-wrap gap-1.5">
            {(c.tags || []).map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                <TagIcon className="w-3 h-3" />{t}
              </span>
            ))}
            {(data.conversation?.labels || []).map((l) => (
              <span key={l} className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{l}</span>
            ))}
            {!(c.tags || []).length && !(data.conversation?.labels || []).length && (
              <span className="text-xs text-muted-foreground">No tags yet.</span>
            )}
          </div>
        </div>
      </aside>

      {/* CENTER — KPIs + tabs */}
      <section className="flex-1 min-w-0 flex flex-col overflow-y-auto bg-background">
        <div className="p-6 pb-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Total messages" value={k.totalMessages} sub={`${k.incoming} in · ${k.outgoing} out`} />
            <Kpi label="Reply rate" value={`${k.replyRate}%`} sub={`${k.aiReplies} AI · ${k.agentReplies} agent replies`} />
            <Kpi label="Avg response" value={fmtDur(k.avgResponseSec)} sub="customer → first reply" />
            <Kpi label="Delivery / read" value={`${k.deliveryRate}% · ${k.readRate}%`} sub={`${k.failed} failed`} />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Kpi label="First contact" value={k.firstContactAt ? new Date(k.firstContactAt).toLocaleDateString() : "—"} sub={fmtDate(k.firstContactAt)} />
            <Kpi label="Last contact" value={data.inactiveDays === null ? "—" : data.inactiveDays === 0 ? "Today" : `${data.inactiveDays}d ago`} sub={fmtDate(k.lastContactAt)} />
          </div>
        </div>

        <div className="px-6 pt-5 flex gap-1.5 border-b sticky top-0 bg-background z-10">
          {([["timeline", "Timeline"], ["campaigns", `Campaigns (${data.campaignHistory.length})`], ["notes", `Notes (${data.notes.length})`]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={clsx(
                "px-4 h-9 text-[13px] font-medium border-b-2 -mb-px",
                tab === v ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === "timeline" && (
            <div className="space-y-0">
              {data.timeline.map((e, i) => {
                const meta = EVENT_META[e.type] || EVENT_META.campaign;
                const Icon = meta.icon;
                return (
                  <div key={i} className="flex gap-3 relative pb-5">
                    {i < data.timeline.length - 1 && <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />}
                    <div className={clsx("w-8 h-8 rounded-full grid place-items-center shrink-0", meta.cls)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <div className="text-sm font-medium">{e.title}
                        <span className="text-[11px] text-muted-foreground font-normal ml-2">{fmtDate(e.at)}</span>
                      </div>
                      {e.detail && <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-xl">{e.detail}</div>}
                    </div>
                  </div>
                );
              })}
              {data.timeline.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
            </div>
          )}

          {tab === "campaigns" && (
            <div className="rounded-xl border bg-card shadow-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wide border-b bg-muted/40">
                    <th className="px-4 py-2.5 font-medium">Campaign</th>
                    <th className="px-3 py-2.5 font-medium">Template</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campaignHistory.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">{r.campaignName}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{r.templateName || "—"}</td>
                      <td className="px-3 py-2.5">
                        <span className={clsx(
                          "text-[11px] px-2 py-0.5 rounded-full font-medium",
                          r.status === "READ" ? "bg-accent text-accent-foreground" :
                          r.status === "DELIVERED" ? "bg-success/15 text-success" :
                          r.status === "FAILED" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
                        )}>{r.status.toLowerCase()}</span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">{fmtDate(r.sentAt)}</td>
                    </tr>
                  ))}
                  {data.campaignHistory.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-5 text-muted-foreground">No campaigns sent to this contact yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === "notes" && (
            <div className="max-w-2xl space-y-3">
              {data.conversation && (
                <div className="flex gap-2">
                  <input className={inputCls} placeholder="Add an internal note…" value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} />
                  <button className={btnPri} disabled={!noteDraft.trim()} onClick={addNote}>Add</button>
                </div>
              )}
              {data.notes.map((n) => (
                <div key={n.id} className="rounded-xl border border-warning/25 bg-warning/10 px-4 py-3">
                  <div className="text-sm">{n.body}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{n.authorName || "agent"} · {fmtDate(n.createdAt)}</div>
                </div>
              ))}
              {data.notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
            </div>
          )}
        </div>
      </section>

      {/* RIGHT — health + AI */}
      <aside className="w-72 shrink-0 border-l bg-card overflow-y-auto hidden xl:block">
        <div className="p-5 border-b text-center">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Customer health</div>
          <div className="flex justify-center"><HealthRing score={data.healthScore} /></div>
          <div className="text-xs text-muted-foreground mt-2">
            {data.healthScore >= 65 ? "Healthy & engaged" : data.healthScore >= 40 ? "Needs attention" : "At risk"}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4 text-left">
            <div className="rounded-lg bg-muted/60 p-2.5">
              <div className="text-[10px] text-muted-foreground">Read rate</div>
              <div className="text-sm font-semibold">{k.readRate}%</div>
            </div>
            <div className="rounded-lg bg-muted/60 p-2.5">
              <div className="text-[10px] text-muted-foreground">Reply rate</div>
              <div className="text-sm font-semibold">{k.replyRate}%</div>
            </div>
            <div className="rounded-lg bg-muted/60 p-2.5">
              <div className="text-[10px] text-muted-foreground">Inactive</div>
              <div className="text-sm font-semibold">{data.inactiveDays === null ? "—" : `${data.inactiveDays}d`}</div>
            </div>
            <div className="rounded-lg bg-muted/60 p-2.5">
              <div className="text-[10px] text-muted-foreground">Campaigns</div>
              <div className="text-sm font-semibold">{data.campaignHistory.length}</div>
            </div>
          </div>
        </div>

        <div className="p-4 border-b">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold">AI insights</span>
            {assist && <span className="ml-auto text-[10px] text-muted-foreground">{assist.engine === "llm" ? "AI" : "rules"}</span>}
          </div>
          {!data.conversation ? (
            <p className="text-xs text-muted-foreground">No conversation yet — insights appear after the first message.</p>
          ) : !assist ? (
            <button onClick={analyze} disabled={analyzing}
              className="w-full h-8 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-60 flex items-center justify-center gap-1.5">
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {analyzing ? "Analyzing…" : "Analyze customer"}
            </button>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex gap-1.5">
                <span className={clsx("px-2 py-0.5 rounded-full font-medium",
                  assist.sentiment === "positive" ? "bg-success/15 text-success" :
                  assist.sentiment === "negative" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground")}>
                  {assist.sentiment}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{assist.intent}</span>
              </div>
              <p className="leading-relaxed text-foreground/85">{assist.summary}</p>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground pt-1">Next best actions</div>
              {assist.suggestions.map((s, i) => <div key={i} className="rounded-lg border bg-background px-2.5 py-1.5">{s}</div>)}
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Custom fields</div>
          <div className="space-y-1.5 text-xs">
            {data.fields.map((f) => (
              <div key={f.id} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{f.label}</span>
                <span className="font-medium">{(c.attributes as Record<string, string> | null)?.[f.key] ?? "—"}</span>
              </div>
            ))}
            {data.fields.length === 0 && <p className="text-muted-foreground">No custom fields defined.</p>}
          </div>
        </div>
      </aside>

    </div>
  );
}
