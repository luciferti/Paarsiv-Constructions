"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { getDashboardSummary } from "@/lib/api/dashboard";
import { seedDemoData } from "@/lib/api/demo";
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
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getDashboardSummary()
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSeed() {
    setSeeding(true);
    setSeedError(null);
    try {
      await seedDemoData();
      load();
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : "Couldn't load sample data");
    } finally {
      setSeeding(false);
    }
  }

  if (loading) return <div className="sites-page">Loading dashboard...</div>;
  if (error) return <div className="sites-page"><p className="form-error">{error}</p></div>;
  if (!summary) return null;

  const activeSites = summary.sites_by_status.active ?? 0;
  const isEmptyOrg =
    summary.total_sites === 0 && summary.total_vendors === 0 && summary.total_materials === 0;

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <h1>Dashboard</h1>
      </div>

      {isEmptyOrg && (
        <div className="seed-card">
          <div>
            <h2 className="seed-card-title">Welcome! Your workspace is empty.</h2>
            <p className="seed-card-text">
              Load a realistic sample project — sites, workers, purchase orders, budgets,
              subcontractors, equipment and more — to explore everything in seconds. You can
              delete it later or start adding your own data anytime.
            </p>
            {seedError && <p className="form-error">{seedError}</p>}
          </div>
          <button type="button" className="button-primary" onClick={handleSeed} disabled={seeding}>
            {seeding ? "Loading sample data…" : "Load sample data"}
          </button>
        </div>
      )}

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
