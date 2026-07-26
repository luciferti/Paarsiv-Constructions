"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, CheckCheck, Clock, Download, Eye, Loader2,
  Search, Send as SendIcon, Users,
} from "lucide-react";
import {
  Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import clsx from "clsx";
import { api } from "@/lib/api";
import Pagination, { EMPTY_PAGE, type PageMeta } from "@/components/Pagination";
import type { CampaignRecipient } from "@/lib/types";

interface CampaignDetail {
  id: string;
  name: string;
  status: string;
  totalCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  scheduledAt?: string | null;
  recipients: CampaignRecipient[];
  template?: { name: string; body: string } | null;
}

const BADGE: Record<string, string> = {
  READ: "bg-accent text-accent-foreground",
  DELIVERED: "bg-success/15 text-success",
  SENT: "bg-muted text-muted-foreground",
  QUEUED: "bg-muted text-muted-foreground",
  FAILED: "bg-destructive/15 text-destructive",
};
const SLICE = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))"];

function Stat({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={clsx("w-4 h-4", tone)} />
        <span className="text-[13px] font-medium">{label}</span>
      </div>
      <div className="mt-1.5 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function fmt(iso?: string | null) {
  return iso ? new Date(iso).toLocaleString() : "—";
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<CampaignDetail | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [recMeta, setRecMeta] = useState<PageMeta>(EMPTY_PAGE);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    api.get<{ campaign: CampaignDetail; recipients: PageMeta }>(`/campaigns/${id}?page=${page}&pageSize=50`)
      .then((r) => { setData(r.campaign); setRecMeta(r.recipients); })
      .catch(() => {});
  }, [id, page]);
  useEffect(load, [load]);

  const recipients = useMemo(() => {
    if (!data) return [];
    return data.recipients.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (r.name || "").toLowerCase().includes(q) || r.phone.includes(q);
      }
      return true;
    });
  }, [data, filter, search]);

  if (!data) {
    return <div className="flex-1 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  const funnel = [
    { stage: "Sent", value: data.sentCount },
    { stage: "Delivered", value: data.deliveredCount },
    { stage: "Read", value: data.readCount },
    { stage: "Failed", value: data.failedCount },
  ];
  const donut = [
    { name: "Read", value: data.readCount },
    { name: "Delivered", value: Math.max(0, data.deliveredCount - data.readCount) },
    { name: "Sent only", value: Math.max(0, data.sentCount - data.deliveredCount) },
    { name: "Failed", value: data.failedCount },
  ].filter((d) => d.value > 0);

  const rate = (n: number) => (data.sentCount ? Math.round((n / data.sentCount) * 100) : 0);

  function exportCsv() {
    if (!data) return;
    const rows = [["Name", "Phone", "Status", "Sent at", "Error"].join(",")];
    for (const r of recipients) {
      rows.push([r.name || "", `+${r.phone}`, r.status, r.sentAt || "", r.error || ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${data.name}-recipients.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const STATUSES = ["all", "READ", "DELIVERED", "SENT", "FAILED"];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* header */}
      <div className="px-8 py-5 border-b bg-card/50 flex items-center gap-3">
        <button onClick={() => router.push("/reports")} className="p-2 -ml-2 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold truncate">{data.name}</h1>
            <span className={clsx(
              "text-[11px] px-2 py-0.5 rounded-full font-medium",
              data.status === "SENT" ? "bg-accent text-accent-foreground" :
              data.status === "FAILED" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
            )}>{data.status.toLowerCase()}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.template?.name ? `Template: ${data.template.name} · ` : ""}
            Created {fmt(data.createdAt)}{data.finishedAt ? ` · finished ${fmt(data.finishedAt)}` : ""}
          </p>
        </div>
        <div className="flex-1" />
        <button className="h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted" onClick={exportCsv}>
          <Download className="w-3.5 h-3.5 inline mr-1.5" />Export
        </button>
      </div>

      <div className="p-8 space-y-6 max-w-6xl">
        {/* stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Stat icon={Users} label="Audience" value={data.totalCount} />
          <Stat icon={SendIcon} label="Sent" value={data.sentCount} tone="text-primary" />
          <Stat icon={CheckCheck} label="Delivered" value={data.deliveredCount} tone="text-success" />
          <Stat icon={Eye} label="Read" value={data.readCount} tone="text-primary" />
          <Stat icon={AlertTriangle} label="Failed" value={data.failedCount} tone="text-destructive" />
        </div>

        {/* charts */}
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border bg-card p-5 shadow-card">
            <h2 className="text-[15px] font-semibold">Delivery funnel</h2>
            <p className="text-xs text-muted-foreground mt-0.5 mb-4">
              Delivery {rate(data.deliveredCount)}% · read {rate(data.readCount)}%
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnel} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="stage" width={78} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={26}>
                  {funnel.map((f, i) => (
                    <Cell key={f.stage} fill={i === 3 ? "hsl(var(--destructive))" : i === 1 ? "hsl(var(--success))" : "hsl(var(--primary))"} fillOpacity={i === 2 ? 0.65 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-card">
            <h2 className="text-[15px] font-semibold">Outcome mix</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Share of every message sent</p>
            {donut.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={donut} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={2}>
                    {donut.map((_, i) => <Cell key={i} fill={SLICE[i % SLICE.length]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground mt-8 text-center">Nothing sent yet.</p>
            )}
          </div>
        </div>

        {/* timeline facts */}
        <div className="rounded-xl border bg-card p-5 shadow-card grid sm:grid-cols-3 gap-4 text-sm">
          <div><div className="text-xs text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Scheduled</div><div className="mt-1 font-medium">{fmt(data.scheduledAt)}</div></div>
          <div><div className="text-xs text-muted-foreground flex items-center gap-1.5"><SendIcon className="w-3.5 h-3.5" />Started</div><div className="mt-1 font-medium">{fmt(data.startedAt)}</div></div>
          <div><div className="text-xs text-muted-foreground flex items-center gap-1.5"><CheckCheck className="w-3.5 h-3.5" />Finished</div><div className="mt-1 font-medium">{fmt(data.finishedAt)}</div></div>
        </div>

        {/* recipients */}
        <div className="rounded-xl border bg-card shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-3 flex-wrap">
            <div>
              <h2 className="text-[15px] font-semibold">Recipients</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{recMeta.total} recipients{search || filter !== "all" ? ` · ${recipients.length} match on this page` : ""}</p>
            </div>
            <div className="flex-1" />
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or number"
                className="h-9 w-56 pl-9 pr-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex gap-1.5">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => setFilter(s)}
                  className={clsx("h-8 px-2.5 rounded-full text-xs font-medium border",
                    filter === s ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-muted")}>
                  {s === "all" ? "All" : s.toLowerCase()}
                </button>
              ))}
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wide border-b bg-muted/40">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Phone</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Sent at</th>
                <th className="px-3 py-3 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-5 py-2.5 font-medium">{r.name || "Unknown"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">+{r.phone}</td>
                  <td className="px-3 py-2.5">
                    <span className={clsx("text-[11px] px-2 py-0.5 rounded-full font-medium", BADGE[r.status] || BADGE.SENT)}>
                      {r.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">{fmt(r.sentAt)}</td>
                  <td className="px-3 py-2.5 text-destructive text-xs">{r.error || "—"}</td>
                </tr>
              ))}
              {recipients.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-6 text-muted-foreground">No recipients match.</td></tr>
              )}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t">
            <Pagination meta={recMeta} label="recipients" onPage={setPage} />
          </div>
        </div>
      </div>
    </div>
  );
}
