"use client";

import { useEffect, useState } from "react";
import { Users, MessageSquare, Bot, Megaphone, CheckCheck, Eye } from "lucide-react";
import { api } from "@/lib/api";
import DateRangeFilter, { DEFAULT_RANGE, rangeQuery, type DateRange } from "@/components/DateRangeFilter";

interface Overview {
  audience: { contacts: number; optedIn: number };
  inbox: { conversations: number; aiReplies: number; agentReplies: number };
  campaigns: {
    count: number;
    totals: { sent: number; delivered: number; read: number; failed: number };
    deliveryRate: number;
    readRate: number;
    list: {
      id: string; name: string; status: string; totalCount: number;
      sentCount: number; deliveredCount: number; readCount: number; readRate: number;
    }[];
  };
}

function Stat({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-[13px] font-medium">{label}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Bar({ label, value, max, cls }: { label: string; value: number; max: number; cls: string }) {
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

export default function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);

  useEffect(() => {
    api.get<Overview>(`/reports/overview?_${rangeQuery(range)}`).then(setData).catch(() => {});
  }, [range]);

  if (!data) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  const t = data.campaigns.totals;
  const max = Math.max(t.sent, 1);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 border-b bg-card/50 flex items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your workspace at a glance</p>
        </div>
        <div className="flex-1" />
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      <div className="p-8 space-y-6 max-w-6xl">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon={Users} label="Contacts" value={data.audience.contacts} sub={`${data.audience.optedIn} opted in`} />
          <Stat icon={MessageSquare} label="Conversations" value={data.inbox.conversations} />
          <Stat icon={Bot} label="AI replies" value={data.inbox.aiReplies} sub={`${data.inbox.agentReplies} by agents`} />
          <Stat icon={Megaphone} label="Campaigns" value={data.campaigns.count} sub={`${data.campaigns.readRate}% read rate`} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-card p-6 shadow-card">
            <div className="flex items-center gap-2 mb-1">
              <CheckCheck className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold">Campaign delivery</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Delivery {data.campaigns.deliveryRate}% · read {data.campaigns.readRate}%
            </p>
            <div className="space-y-3">
              <Bar label="Sent" value={t.sent} max={max} cls="bg-primary" />
              <Bar label="Delivered" value={t.delivered} max={max} cls="bg-success" />
              <Bar label="Read" value={t.read} max={max} cls="bg-primary/60" />
              <Bar label="Failed" value={t.failed} max={max} cls="bg-destructive" />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold">Recent campaigns</h2>
            </div>
            <div className="space-y-2">
              {data.campaigns.list.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.sentCount}/{c.totalCount} sent · {c.readCount} read
                    </div>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    c.status === "SENT" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {c.status.toLowerCase()}
                  </span>
                </div>
              ))}
              {data.campaigns.list.length === 0 && (
                <p className="text-sm text-muted-foreground">No campaigns yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
