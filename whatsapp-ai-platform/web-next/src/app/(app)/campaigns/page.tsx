"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Trash2 } from "lucide-react";
import clsx from "clsx";
import { api, getSession } from "@/lib/api";
import type { CampaignSummary } from "@/lib/types";
import DateRangeFilter, { DEFAULT_RANGE, rangeQuery, type DateRange } from "@/components/DateRangeFilter";
import Pagination, { EMPTY_PAGE, type PageMeta } from "@/components/Pagination";

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
  const router = useRouter();
  const session = typeof window !== "undefined" ? getSession() : null;
  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "RM";
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [range, setRange] = useState<DateRange>(DEFAULT_RANGE);
  const [meta, setMeta] = useState<PageMeta>(EMPTY_PAGE);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const load = useCallback(() => {
    api.get<{ campaigns: CampaignSummary[] } & PageMeta>(`/campaigns?page=${page}&pageSize=${pageSize}${rangeQuery(range)}`)
      .then((r) => {
        setCampaigns(r.campaigns);
        setMeta({ total: r.total, page: r.page, pageSize: r.pageSize, pages: r.pages });
      })
      .catch(() => {});
  }, [range, page, pageSize]);
  useEffect(() => {
    load();
  }, [load]);

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
        <DateRangeFilter value={range} onChange={setRange} className="mr-2" />
        {canEdit && <button className={btnPri} onClick={() => router.push('/campaigns/new')}>+ New campaign</button>}
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
        <Pagination meta={meta} label="campaigns" className="mt-4"
          onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
      </div>

    </div>
  );
}
