"use client";

import { Can } from "@/components/auth/Can";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { getSafetySummary, listIncidents } from "@/lib/api/safety";
import {
  INCIDENT_STATUS_LABEL,
  INCIDENT_TYPE_LABEL,
  IncidentListItem,
  IncidentStatus,
  INCIDENT_STATUSES,
  SafetySummary,
} from "@/lib/types/safety";

const SEV_CLASS: Record<string, string> = {
  low: "status-active",
  medium: "status-planning",
  high: "status-pending_review",
  critical: "status-blacklisted",
};

export default function SafetyPage() {
  const router = useRouter();
  const [status, setStatus] = useState<IncidentStatus | "all">("all");
  const [items, setItems] = useState<IncidentListItem[] | null>(null);
  const [summary, setSummary] = useState<SafetySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      listIncidents({ status: status === "all" ? undefined : status }),
      getSafetySummary(),
    ])
      .then(([list, sum]) => {
        setItems(list.items);
        setSummary(sum);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <h1>Safety</h1>
        <Can perm="safety:create">
          <Link href="/safety/new" className="button-primary">
          + Report Incident
        </Link>
        </Can>
      </div>

      {error && <p className="form-error">{error}</p>}

      {summary && (
        <div className="budget-cards">
          <div className="budget-card">
            <div className="budget-card-label">Days Since Last Incident</div>
            <div className="budget-card-value budget-under">
              {summary.days_since_last_incident ?? "—"}
            </div>
          </div>
          <div className="budget-card">
            <div className="budget-card-label">Open Incidents</div>
            <div className="budget-card-value budget-over">{summary.open_count}</div>
          </div>
          <div className="budget-card">
            <div className="budget-card-label">Total Logged</div>
            <div className="budget-card-value">{summary.total}</div>
          </div>
        </div>
      )}

      <div className="sites-filters">
        <button className={status === "all" ? "filter-active" : ""} onClick={() => setStatus("all")}>
          All
        </button>
        {INCIDENT_STATUSES.map((s) => (
          <button key={s} className={s === status ? "filter-active" : ""} onClick={() => setStatus(s)}>
            {INCIDENT_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {items && items.length === 0 && (
        <p className="empty-state">No incidents logged. A clean safety record — keep it up.</p>
      )}
      {items && items.length > 0 && (
        <table className="site-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Title</th>
              <th>Type</th>
              <th>Severity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((inc) => (
              <tr key={inc.id} onClick={() => router.push(`/safety/${inc.id}`)}>
                <td>{inc.incident_date}</td>
                <td className="cell-name">{inc.title}</td>
                <td>{INCIDENT_TYPE_LABEL[inc.incident_type]}</td>
                <td>
                  <span className={`status-badge ${SEV_CLASS[inc.severity]}`}>{inc.severity}</span>
                </td>
                <td>
                  <span className={`status-badge status-${inc.status}`}>
                    {INCIDENT_STATUS_LABEL[inc.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
