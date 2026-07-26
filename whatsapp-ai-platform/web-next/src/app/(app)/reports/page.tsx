"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot, CheckCheck, ChevronRight, Eye, MessageSquare, Send as SendIcon,
  Timer, TrendingUp, Users, UsersRound,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import clsx from "clsx";
import { api } from "@/lib/api";
import DateRangeFilter, { DEFAULT_RANGE, rangeQuery, type DateRange } from "@/components/DateRangeFilter";
import Pagination, { EMPTY_PAGE, type PageMeta } from "@/components/Pagination";
import type { CampaignSummary, ReportOverview } from "@/lib/types";

interface AgentReport {
  avgFirstResponseSec: number | null;
  conversationsMeasured: number;
  agents: {
    id: string; displayName: string; role: string; team?: string | null;
    presence?: string; replies: number; lastActive?: string | null;
    assignedConversations: number;
  }[];
}
interface SeriesPoint {
  date: string; incoming: number; ai: number; agent: number;
  conversations: number; contacts: number;
}
interface Breakdown {
  cities: { name: string; value: number }[];
  tags: { name: string; value: number }[];
  sources: { name: string; value: number }[];
  optIn: { name: string; value: number }[];
  total: number;
}

const SLICE = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "#7f77dd", "#d4537e", "#378add"];

const axis = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  fontSize: 12,
};

function fmtDuration(sec: number | null): string {
  if (sec === null) return "—";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}
const shortDay = (d: string) => d.slice(5).replace("-", "/");

function Kpi({ icon: Icon, label, value, sub, tone }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; tone?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={clsx("w-4 h-4", tone)} />
        <span className="text-[12px] font-medium">{label}</span>
      </div>
      <div className="mt-1.5 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [data, setData] = useState<ReportOverview | null>(null);
  const [agents, setAgents] = useState<AgentReport | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [campaigns, setCampaigns] = useState<(CampaignSummary & { readRate: number })[]>([]);
  const [campMeta, setCampMeta] = useState<PageMeta>(EMPTY_PAGE);
  const [campPage, setCampPage] = useState(1);

  useEffect(() => {
    const q = `?_${rangeQuery(range)}`;
    api.get<ReportOverview>(`/reports/overview${q}`).then(setData).catch(() => {});
    api.get<AgentReport>(`/reports/agents${q}`).then(setAgents).catch(() => {});
    api.get<{ series: SeriesPoint[] }>(`/reports/timeseries${q}`).then((r) => setSeries(r.series)).catch(() => {});
    api.get<Breakdown>(`/reports/breakdown${q}`).then(setBreakdown).catch(() => {});
  }, [range]);

  useEffect(() => { setCampPage(1); }, [range]);
  useEffect(() => {
    api.get<{ campaigns: (CampaignSummary & { readRate: number })[] } & PageMeta>(
      `/campaigns?page=${campPage}&pageSize=10${rangeQuery(range)}`
    )
      .then((r) => {
        setCampaigns(r.campaigns);
        setCampMeta({ total: r.total, page: r.page, pageSize: r.pageSize, pages: r.pages });
      })
      .catch(() => {});
  }, [range, campPage]);

  if (!data) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  const t = data.campaigns.totals;
  const totalMessages = series.reduce((a, s) => a + s.incoming + s.ai + s.agent, 0);
  const funnel = [
    { stage: "Sent", value: t.sent },
    { stage: "Delivered", value: t.delivered },
    { stage: "Read", value: t.read },
    { stage: "Failed", value: t.failed },
  ];
  const topAgents = [...(agents?.agents || [])].sort((a, b) => b.replies - a.replies).slice(0, 6);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 border-b bg-card/50 flex items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Messaging activity, campaign performance and team output</p>
        </div>
        <div className="flex-1" />
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      <div className="p-8 space-y-6 max-w-6xl">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Kpi icon={MessageSquare} label="Messages" value={totalMessages} sub="in + out" tone="text-primary" />
          <Kpi icon={Users} label="Contacts" value={data.audience.contacts} sub={`${data.audience.optedIn} opted in`} />
          <Kpi icon={Bot} label="AI replies" value={data.inbox.aiReplies} sub={`${data.inbox.agentReplies} by agents`} tone="text-primary" />
          <Kpi icon={Timer} label="Avg response" value={fmtDuration(agents?.avgFirstResponseSec ?? null)} sub="first reply" tone="text-warning" />
          <Kpi icon={Eye} label="Read rate" value={`${data.campaigns.readRate}%`} sub={`${data.campaigns.count} campaigns`} tone="text-success" />
        </div>

        {/* activity over time */}
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-[15px] font-semibold">Message activity</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Daily inbound vs AI vs agent messages</p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={series} margin={{ left: -18, right: 8 }}>
              <defs>
                <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gAi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDay} tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `Date ${l}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="incoming" name="Customer" stroke="hsl(var(--primary))" fill="url(#gIn)" strokeWidth={2} />
              <Area type="monotone" dataKey="ai" name="AI" stroke="hsl(var(--success))" fill="url(#gAi)" strokeWidth={2} />
              <Area type="monotone" dataKey="agent" name="Agent" stroke="hsl(var(--warning))" fill="transparent" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* funnel + growth */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 mb-1">
              <CheckCheck className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold">Campaign funnel</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Delivery {data.campaigns.deliveryRate}% · read {data.campaigns.readRate}%
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnel} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="stage" width={76} tick={axis} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={26}>
                  {funnel.map((f, i) => (
                    <Cell key={f.stage} fill={i === 3 ? "hsl(var(--destructive))" : i === 1 ? "hsl(var(--success))" : "hsl(var(--primary))"} fillOpacity={i === 2 ? 0.6 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold">Audience growth</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">New contacts and conversations per day</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={series} margin={{ left: -18, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDay} tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="contacts" name="New contacts" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="conversations" name="Conversations" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* audience breakdown */}
        {breakdown && breakdown.total > 0 && (
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="rounded-xl border bg-card p-5 shadow-card">
              <h2 className="text-[15px] font-semibold">Top cities</h2>
              <p className="text-xs text-muted-foreground mb-3">Where contacts are from</p>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={breakdown.cities} margin={{ left: -22, right: 8 }}>
                  <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border bg-card p-5 shadow-card">
              <h2 className="text-[15px] font-semibold">Tags</h2>
              <p className="text-xs text-muted-foreground mb-3">Most used contact tags</p>
              {breakdown.tags.length ? (
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie data={breakdown.tags} dataKey="value" nameKey="name" innerRadius={40} outerRadius={66} paddingAngle={2}>
                      {breakdown.tags.map((_, i) => <Cell key={i} fill={SLICE[i % SLICE.length]} />)}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground">No tags yet.</p>}
            </div>

            <div className="rounded-xl border bg-card p-5 shadow-card">
              <h2 className="text-[15px] font-semibold">How they arrived</h2>
              <p className="text-xs text-muted-foreground mb-3">Contact source</p>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={breakdown.sources} dataKey="value" nameKey="name" innerRadius={40} outerRadius={66} paddingAngle={2}>
                    {breakdown.sources.map((_, i) => <Cell key={i} fill={SLICE[(i + 2) % SLICE.length]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* campaign-level table */}
        <div className="rounded-xl border bg-card shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-[15px] font-semibold">Campaign performance</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{campMeta.total} campaigns · click one to open its full report</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wide border-b bg-muted/40">
                <th className="px-6 py-3 font-medium">Campaign</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium text-right">Audience</th>
                <th className="px-3 py-3 font-medium text-right">Sent</th>
                <th className="px-3 py-3 font-medium text-right">Delivered</th>
                <th className="px-3 py-3 font-medium text-right">Read</th>
                <th className="px-3 py-3 font-medium text-right">Failed</th>
                <th className="px-3 py-3 font-medium w-32">Read rate</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} onClick={() => router.push(`/campaigns/${c.id}`)}
                  className="border-b last:border-0 hover:bg-muted/40 cursor-pointer">
                  <td className="px-6 py-3 font-medium">{c.name}</td>
                  <td className="px-3 py-3">
                    <span className={clsx("text-[11px] px-2 py-0.5 rounded-full font-medium",
                      c.status === "SENT" ? "bg-accent text-accent-foreground" :
                      c.status === "FAILED" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground")}>
                      {c.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">{c.totalCount}</td>
                  <td className="px-3 py-3 text-right">{c.sentCount}</td>
                  <td className="px-3 py-3 text-right">{c.deliveredCount}</td>
                  <td className="px-3 py-3 text-right">{c.readCount}</td>
                  <td className="px-3 py-3 text-right">{c.failedCount}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${c.readRate}%` }} />
                      </div>
                      <span className="text-xs font-semibold w-8 text-right">{c.readRate}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground"><ChevronRight className="w-4 h-4" /></td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr><td colSpan={9} className="px-6 py-6 text-muted-foreground">No campaigns in this period.</td></tr>
              )}
            </tbody>
          </table>
          <div className="px-6 py-3 border-t">
            <Pagination meta={campMeta} label="campaigns" onPage={setCampPage} />
          </div>
        </div>

        {/* agent leaderboard */}
        {agents && topAgents.length > 0 && (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-5 shadow-card">
              <div className="flex items-center gap-2 mb-1">
                <UsersRound className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-[15px] font-semibold">Agent replies</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Who is answering customers</p>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={topAgents} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="displayName" width={110} tick={axis} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={tooltipStyle} />
                  <Bar dataKey="replies" name="Replies" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border bg-card shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold">Team</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Replies and assigned conversations</p>
                </div>
                <div className="flex-1" />
                <div className="text-right">
                  <div className="text-lg font-semibold flex items-center gap-1.5 justify-end">
                    <Timer className="w-4 h-4 text-primary" />{fmtDuration(agents.avgFirstResponseSec)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">avg first response</div>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wide border-b bg-muted/40">
                    <th className="px-5 py-2.5 font-medium">Agent</th>
                    <th className="px-3 py-2.5 font-medium">Role</th>
                    <th className="px-3 py-2.5 font-medium text-right">Replies</th>
                    <th className="px-3 py-2.5 font-medium text-right">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.agents.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-5 py-2.5 font-medium">{a.displayName}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{a.role}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{a.replies}</td>
                      <td className="px-3 py-2.5 text-right">{a.assignedConversations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
