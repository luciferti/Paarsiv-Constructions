import { useEffect, useState } from "react";
import { api } from "../api";
import type { ReportOverview } from "../types";

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
      <span className="bar-val">{value}</span>
    </div>
  );
}

export default function Reports() {
  const [data, setData] = useState<ReportOverview | null>(null);

  useEffect(() => {
    api.get<ReportOverview>("/reports/overview").then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="panel-view"><p>Loading…</p></div>;
  const t = data.campaigns.totals;
  const max = Math.max(t.sent, 1);

  return (
    <div className="panel-view">
      <div className="card">
        <h2>Overview</h2>
        <p className="card-sub">Headline numbers across audience, inbox and campaigns.</p>
        <div className="row">
          <div className="stat"><div className="n">{data.audience.contacts}</div><div className="l">Contacts</div></div>
          <div className="stat"><div className="n">{data.audience.optedIn}</div><div className="l">Opted in</div></div>
          <div className="stat"><div className="n">{data.inbox.conversations}</div><div className="l">Conversations</div></div>
          <div className="stat"><div className="n">{data.inbox.aiReplies}</div><div className="l">AI replies</div></div>
          <div className="stat"><div className="n">{data.campaigns.count}</div><div className="l">Campaigns</div></div>
        </div>
      </div>

      <div className="card">
        <h2>Campaign delivery</h2>
        <p className="card-sub">Across all campaigns · delivery {data.campaigns.deliveryRate}% · read {data.campaigns.readRate}%</p>
        <Bar label="Sent" value={t.sent} max={max} color="var(--header)" />
        <Bar label="Delivered" value={t.delivered} max={max} color="#3aa17e" />
        <Bar label="Read" value={t.read} max={max} color="#6fce9f" />
        <Bar label="Failed" value={t.failed} max={max} color="#d99" />
      </div>

      <div className="card">
        <h2>Campaigns</h2>
        <p className="card-sub">Per-campaign performance.</p>
        <table className="roster">
          <thead><tr><th>Name</th><th>Status</th><th>Recipients</th><th>Sent</th><th>Delivered</th><th>Read</th><th>Read %</th></tr></thead>
          <tbody>
            {data.campaigns.list.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td><span className={`mini ${c.status === "SENT" ? "ai" : "assignee"}`}>{c.status.toLowerCase()}</span></td>
                <td>{c.totalCount}</td>
                <td>{c.sentCount}</td>
                <td>{c.deliveredCount}</td>
                <td>{c.readCount}</td>
                <td>{c.readRate}%</td>
              </tr>
            ))}
            {data.campaigns.list.length === 0 && <tr><td colSpan={7} style={{ color: "var(--text-soft)", padding: 14 }}>No campaigns yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
