"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getDashboardSummary } from "@/lib/api/dashboard";
import { DashboardSummary } from "@/lib/types/dashboard";

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  archived: "Archived",
};

const NOTIFICATION_STATUS_CLASS: Record<string, string> = {
  sent: "status-active",
  logged: "status-planning",
  failed: "status-blacklisted",
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardSummary()
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="sites-page">Loading dashboard...</div>;
  if (error) return <div className="sites-page"><p className="form-error">{error}</p></div>;
  if (!summary) return null;

  const activeSites = summary.sites_by_status.active ?? 0;

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="stat-tile-grid">
        <div className="stat-tile">
          <span className="stat-tile-value">{summary.total_sites}</span>
          <span className="stat-tile-label">Total Sites</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile-value">{activeSites}</span>
          <span className="stat-tile-label">Active Sites</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile-value">{summary.total_vendors}</span>
          <span className="stat-tile-label">Vendors</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile-value">{summary.total_materials}</span>
          <span className="stat-tile-label">Materials</span>
        </div>
        <div className="stat-tile stat-tile-warning">
          <span className="stat-tile-value">{summary.pending_invoices}</span>
          <span className="stat-tile-label">Invoices Pending Review</span>
        </div>
      </div>

      {Object.keys(summary.sites_by_status).length > 0 && (
        <div className="sites-filters dashboard-status-breakdown">
          {Object.entries(summary.sites_by_status).map(([status, count]) => (
            <span key={status} className={`status-badge status-${status}`}>
              {STATUS_LABEL[status] ?? status}: {count}
            </span>
          ))}
        </div>
      )}

      <div className="dashboard-columns">
        <section className="form-section">
          <h2 className="form-section-title">Recent Daily Reports</h2>
          {summary.recent_reports.length === 0 ? (
            <p className="empty-state">No reports logged yet.</p>
          ) : (
            <ul className="report-list">
              {summary.recent_reports.map((r, i) => (
                <li key={i} className="report-item">
                  <div className="report-item-header">
                    <Link href={`/sites/${r.site_id}`} className="report-date">
                      {r.site_name}
                    </Link>
                    <span className="report-weather">{r.report_date}</span>
                  </div>
                  <p className="report-summary">{r.work_summary}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="form-section">
          <h2 className="form-section-title">Recent Notifications</h2>
          {summary.recent_notifications.length === 0 ? (
            <p className="empty-state">No notifications sent yet.</p>
          ) : (
            <ul className="report-list">
              {summary.recent_notifications.map((n) => (
                <li key={n.id} className="report-item">
                  <div className="report-item-header">
                    <span className="report-date">{n.recipient_name ?? n.recipient_phone}</span>
                    <span className={`status-badge ${NOTIFICATION_STATUS_CLASS[n.status]}`}>
                      {n.status}
                    </span>
                  </div>
                  <p className="report-summary">{n.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
