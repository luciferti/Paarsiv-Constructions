"use client";

import { FormEvent, useState } from "react";

import { createSiteReport } from "@/lib/api/reports";
import { useSiteReports } from "@/lib/hooks/useReports";

export function SiteReportsPanel({ siteId }: { siteId: string }) {
  const { data: reports, loading, error, refetch } = useSiteReports(siteId);

  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manpower, setManpower] = useState("");
  const [weather, setWeather] = useState("");
  const [workSummary, setWorkSummary] = useState("");
  const [issues, setIssues] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!workSummary.trim()) {
      setFormError("Work summary is required");
      return;
    }

    setSubmitting(true);
    try {
      await createSiteReport(siteId, {
        report_date: reportDate,
        manpower_count: manpower ? Number(manpower) : null,
        weather: weather || null,
        work_summary: workSummary,
        issues: issues || null,
      });
      setManpower("");
      setWeather("");
      setWorkSummary("");
      setIssues("");
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading reports...</p>;
  if (error) return <p className="form-error">{error}</p>;

  return (
    <div className="site-team-panel">
      {reports && reports.length > 0 ? (
        <ul className="report-list">
          {reports.map((report) => (
            <li key={report.id} className="report-item">
              <div className="report-item-header">
                <span className="report-date">{report.report_date}</span>
                {report.weather && <span className="report-weather">{report.weather}</span>}
                {report.manpower_count !== null && (
                  <span className="report-manpower">{report.manpower_count} workers</span>
                )}
              </div>
              <p className="report-summary">{report.work_summary}</p>
              {report.issues && <p className="report-issues">⚠ {report.issues}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No daily reports logged for this site yet.</p>
      )}

      <form onSubmit={handleSubmit} className="material-entry-form">
        {formError && <p className="form-error">{formError}</p>}
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="report-date">Date</label>
            <input
              id="report-date"
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="report-manpower">Manpower Count</label>
            <input
              id="report-manpower"
              type="number"
              min="0"
              value={manpower}
              onChange={(e) => setManpower(e.target.value)}
            />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="report-weather">Weather</label>
          <input
            id="report-weather"
            value={weather}
            onChange={(e) => setWeather(e.target.value)}
            placeholder="e.g. Sunny, Rainy"
          />
        </div>
        <div className="form-field">
          <label htmlFor="report-summary">Work Summary</label>
          <textarea
            id="report-summary"
            rows={3}
            value={workSummary}
            onChange={(e) => setWorkSummary(e.target.value)}
            placeholder="What happened on site today?"
          />
        </div>
        <div className="form-field">
          <label htmlFor="report-issues">Issues / Blockers (optional)</label>
          <textarea
            id="report-issues"
            rows={2}
            value={issues}
            onChange={(e) => setIssues(e.target.value)}
          />
        </div>
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "Saving…" : "Log Report"}
        </button>
      </form>
    </div>
  );
}
