"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Send, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { api, getSession } from "@/lib/api";
import type { CampaignSummary, Segment, Template } from "@/lib/types";

const inputCls = "w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const btnPri = "h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-8 px-3 rounded-lg border text-xs font-medium hover:bg-muted";

const STATUS_CLS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SCHEDULED: "bg-warning/15 text-warning",
  SENDING: "bg-warning/15 text-warning",
  SENT: "bg-accent text-accent-foreground",
  FAILED: "bg-destructive/15 text-destructive",
};

export default function CampaignsPage() {
  const session = typeof window !== "undefined" ? getSession() : null;
  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "RM";
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", templateId: "", segmentId: "", when: "now", scheduledAt: "" });

  const load = useCallback(() => {
    api.get<{ campaigns: CampaignSummary[] }>("/campaigns").then((r) => setCampaigns(r.campaigns)).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    api.get<{ templates: Template[] }>("/templates").then((r) => setTemplates(r.templates)).catch(() => {});
    api.get<{ segments: Segment[] }>("/segments").then((r) => setSegments(r.segments)).catch(() => {});
  }, [load]);

  const seg = segments.find((s) => s.id === form.segmentId);

  async function create() {
    if (!form.name.trim() || !form.templateId) return;
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      templateId: form.templateId,
      segmentId: form.segmentId || null,
    };
    if (form.when === "later" && form.scheduledAt) {
      body.scheduledAt = new Date(form.scheduledAt).toISOString();
    }
    await api.post("/campaigns", body);
    setForm({ name: "", templateId: "", segmentId: "", when: "now", scheduledAt: "" });
    setOpen(false);
    load();
  }

  async function send(id: string) {
    await api.post(`/campaigns/${id}/send`);
    setTimeout(load, 900);
    setTimeout(load, 2600);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 border-b bg-card/50 flex items-center">
        <div>
          <h1 className="text-xl font-semibold">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Broadcast a template to a segment — now or on a schedule</p>
        </div>
        <div className="flex-1" />
        {canEdit && <button className={btnPri} onClick={() => setOpen(true)}>+ New campaign</button>}
      </div>

      <div className="p-8 max-w-6xl">
        <div className="rounded-xl border bg-card shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wide border-b bg-muted/40">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Template</th>
                <th className="px-3 py-3 font-medium">Segment</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Progress</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-6 py-3 font-medium">{c.name}</td>
                  <td className="px-3 py-3 text-muted-foreground">{c.templateName || "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{c.segmentName}</td>
                  <td className="px-3 py-3">
                    <span className={clsx("text-[11px] px-2 py-0.5 rounded-full font-medium", STATUS_CLS[c.status] || STATUS_CLS.DRAFT)}>
                      {c.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {c.status === "SENT" || c.status === "SENDING"
                      ? `${c.sentCount}/${c.totalCount} · ${c.readCount} read`
                      : `${c.totalCount} recipients`}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {canEdit && c.status === "DRAFT" && (
                      <button className={btnPri} onClick={() => send(c.id)}>
                        <Send className="w-3 h-3 inline mr-1" />Send
                      </button>
                    )}
                    {canEdit && (
                      <Trash2
                        className="w-4 h-4 inline ml-3 text-muted-foreground hover:text-destructive cursor-pointer"
                        onClick={() => api.del(`/campaigns/${c.id}`).then(load)}
                      />
                    )}
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-6 text-muted-foreground">No campaigns yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => setOpen(false)}>
          <div className="w-[420px] max-w-[92vw] h-full bg-card border-l flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <span className="font-semibold">New campaign</span>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-md hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3 text-sm">
              <div>
                <label className="text-xs text-muted-foreground">Name</label>
                <input className={clsx(inputCls, "mt-1")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="August launch" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Template</label>
                <select className={clsx(inputCls, "mt-1")} value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}>
                  <option value="">— pick template —</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Audience</label>
                <select className={clsx(inputCls, "mt-1")} value={form.segmentId} onChange={(e) => setForm({ ...form, segmentId: e.target.value })}>
                  <option value="">All opted-in contacts</option>
                  {segments.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.count})</option>)}
                </select>
                {seg && <p className="text-xs text-muted-foreground mt-1">{seg.count} contacts in this segment</p>}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">When</label>
                <div className="flex gap-1.5 mt-1">
                  {(["now", "later"] as const).map((w) => (
                    <button
                      key={w}
                      className={clsx(
                        "flex-1 h-9 rounded-lg border text-xs font-medium",
                        form.when === w ? "bg-accent text-accent-foreground border-primary" : "text-muted-foreground hover:bg-muted"
                      )}
                      onClick={() => setForm({ ...form, when: w })}
                    >
                      {w === "now" ? "Create draft (send manually)" : "Schedule"}
                    </button>
                  ))}
                </div>
                {form.when === "later" && (
                  <div className="mt-2 flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-muted-foreground" />
                    <input
                      type="datetime-local"
                      className={inputCls}
                      value={form.scheduledAt}
                      onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-3.5 border-t flex items-center gap-2">
              <div className="flex-1" />
              <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
              <button className={btnPri} disabled={!form.name.trim() || !form.templateId || (form.when === "later" && !form.scheduledAt)} onClick={create}>
                {form.when === "later" ? "Schedule" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
