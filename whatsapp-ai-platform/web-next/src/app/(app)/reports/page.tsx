"use client";

import { useEffect, useState } from "react";
import { X, CheckCheck, Eye, Send as SendIcon, AlertTriangle, ChevronRight, Timer, UsersRound } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import DateRangeFilter, { DEFAULT_RANGE, rangeQuery, type DateRange } from "@/components/DateRangeFilter";
import type { CampaignRecipient, ReportOverview } from "@/lib/types";

interface CampaignDetail {
  id: string;
  name: string;
  status: string;
  totalCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  recipients: CampaignRecipient[];
  template?: { name: string; body: string } | null;
}

const RECIP_BADGE: Record<string, string> = {
  READ: "bg-accent text-accent-foreground",
  DELIVERED: "bg-success/15 text-success",
  SENT: "bg-muted text-muted-foreground",
  QUEUED: "bg-muted text-muted-foreground",
  FAILED: "bg-destructive/15 text-destructive",
};

function Funnel({ label, value, max, cls }: { label: string; value: number; max: number; cls: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 text-muted-foreground">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right font-medium">{value}</span>
    </div>
  );
}

interface AgentReport {
  avgFirstResponseSec: number | null;
  conversationsMeasured: number;
  agents: {
    id: string; displayName: string; role: string; team?: string | null;
    presence?: string; replies: number; lastActive?: string | null;
    assignedConversations: number;
  }[];
}

function fmtDuration(sec: number | null): string {
  if (sec === null) return "—";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportOverview | null>(null);
  const [agents, setAgents] = useState<AgentReport | null>(null);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);

  useEffect(() => {
    api.get<ReportOverview>(`/reports/overview?_${rangeQuery(range)}`).then(setData).catch(() => {});
    api.get<AgentReport>(`/reports/agents?_${rangeQuery(range)}`).then(setAgents).catch(() => {});
  }, [range]);

  async function openCampaign(id: string) {
    setLoadingDetail(true);
    try {
      const r = await api.get<{ campaign: CampaignDetail }>(`/campaigns/${id}`);
      setDetail(r.campaign);
    } finally {
      setLoadingDetail(false);
    }
  }

  if (!data) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  const t = data.campaigns.totals;
  const max = Math.max(t.sent, 1);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 border-b bg-card/50 flex items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Delivery, reads and per-campaign performance
          </p>
        </div>
        <div className="flex-1" />
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      <div className="p-8 space-y-6 max-w-6xl">
        {/* Overall funnel */}
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <CheckCheck className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-[15px] font-semibold">All campaigns</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Delivery {data.campaigns.deliveryRate}% · read {data.campaigns.readRate}%
          </p>
          <div className="space-y-3">
            <Funnel label="Sent" value={t.sent} max={max} cls="bg-primary" />
            <Funnel label="Delivered" value={t.delivered} max={max} cls="bg-success" />
            <Funnel label="Read" value={t.read} max={max} cls="bg-primary/60" />
            <Funnel label="Failed" value={t.failed} max={max} cls="bg-destructive" />
          </div>
        </div>

        {/* Campaign-level table */}
        <div className="rounded-xl border bg-card shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-[15px] font-semibold">Campaign performance</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Click a campaign for recipient-level detail</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide border-b bg-muted/40">
                <th className="px-6 py-3 font-medium">Campaign</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium text-right">Audience</th>
                <th className="px-3 py-3 font-medium text-right">Sent</th>
                <th className="px-3 py-3 font-medium text-right">Delivered</th>
                <th className="px-3 py-3 font-medium text-right">Read</th>
                <th className="px-3 py-3 font-medium text-right">Failed</th>
                <th className="px-3 py-3 font-medium text-right">Read %</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.campaigns.list.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => openCampaign(c.id)}
                  className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                >
                  <td className="px-6 py-3 font-medium">{c.name}</td>
                  <td className="px-3 py-3">
                    <span className={clsx(
                      "text-[11px] px-2 py-0.5 rounded-full font-medium",
                      c.status === "SENT" ? "bg-accent text-accent-foreground" :
                      c.status === "FAILED" ? "bg-destructive/15 text-destructive" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {c.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">{c.totalCount}</td>
                  <td className="px-3 py-3 text-right">{c.sentCount}</td>
                  <td className="px-3 py-3 text-right">{c.deliveredCount}</td>
                  <td className="px-3 py-3 text-right">{c.readCount}</td>
                  <td className="px-3 py-3 text-right">{c.failedCount}</td>
                  <td className="px-3 py-3 text-right font-semibold">{c.readRate}%</td>
                  <td className="px-3 py-3 text-muted-foreground"><ChevronRight className="w-4 h-4" /></td>
                </tr>
              ))}
              {data.campaigns.list.length === 0 && (
                <tr><td colSpan={9} className="px-6 py-6 text-muted-foreground">No campaigns yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Agent performance */}
        {agents && (
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center gap-3">
              <div>
                <h2 className="text-[15px] font-semibold flex items-center gap-2">
                  <UsersRound className="w-4 h-4 text-muted-foreground" />Agent performance
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Replies are attributed per agent</p>
              </div>
              <div className="flex-1" />
              <div className="text-right">
                <div className="text-lg font-semibold flex items-center gap-1.5 justify-end">
                  <Timer className="w-4 h-4 text-primary" />{fmtDuration(agents.avgFirstResponseSec)}
                </div>
                <div className="text-[11px] text-muted-foreground">avg first response · {agents.conversationsMeasured} convs</div>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wide border-b bg-muted/40">
                  <th className="px-6 py-3 font-medium">Agent</th>
                  <th className="px-3 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium">Team</th>
                  <th className="px-3 py-3 font-medium text-right">Replies</th>
                  <th className="px-3 py-3 font-medium text-right">Assigned convs</th>
                  <th className="px-3 py-3 font-medium">Last active</th>
                </tr>
              </thead>
              <tbody>
                {agents.agents.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-6 py-3 font-medium">{a.displayName}</td>
                    <td className="px-3 py-3 text-muted-foreground">{a.role}</td>
                    <td className="px-3 py-3 text-muted-foreground">{a.team || "—"}</td>
                    <td className="px-3 py-3 text-right font-semibold">{a.replies}</td>
                    <td className="px-3 py-3 text-right">{a.assignedConversations}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs">
                      {a.lastActive ? new Date(a.lastActive).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Campaign drill-down drawer */}
      {(detail || loadingDetail) && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => setDetail(null)}>
          <div className="w-[480px] max-w-[92vw] h-full bg-card border-l flex flex-col" onClick={(e) => e.stopPropagation()}>
            {detail ? (
              <>
                <div className="px-5 py-4 border-b flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{detail.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {detail.template?.name} · {detail.totalCount} recipients
                    </div>
                  </div>
                  <button onClick={() => setDetail(null)} className="p-1.5 rounded-md hover:bg-muted">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-5 py-4 border-b grid grid-cols-4 gap-3 text-center">
                  <div><div className="text-lg font-semibold flex items-center justify-center gap-1"><SendIcon className="w-3.5 h-3.5 text-primary" />{detail.sentCount}</div><div className="text-[11px] text-muted-foreground">Sent</div></div>
                  <div><div className="text-lg font-semibold flex items-center justify-center gap-1"><CheckCheck className="w-3.5 h-3.5 text-success" />{detail.deliveredCount}</div><div className="text-[11px] text-muted-foreground">Delivered</div></div>
                  <div><div className="text-lg font-semibold flex items-center justify-center gap-1"><Eye className="w-3.5 h-3.5 text-primary" />{detail.readCount}</div><div className="text-[11px] text-muted-foreground">Read</div></div>
                  <div><div className="text-lg font-semibold flex items-center justify-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-destructive" />{detail.failedCount}</div><div className="text-[11px] text-muted-foreground">Failed</div></div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {detail.recipients.map((r) => (
                    <div key={r.id} className="px-5 py-3 border-b border-border/50 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{r.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">+{r.phone}{r.error ? ` · ${r.error}` : ""}</div>
                      </div>
                      <span className={clsx("text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0", RECIP_BADGE[r.status] || RECIP_BADGE.SENT)}>
                        {r.status.toLowerCase()}
                      </span>
                    </div>
                  ))}
                  {detail.recipients.length === 0 && (
                    <p className="p-5 text-sm text-muted-foreground">No recipients recorded.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 grid place-items-center text-sm text-muted-foreground">Loading…</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
