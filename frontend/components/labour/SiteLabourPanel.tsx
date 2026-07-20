"use client";

import { FormEvent, useEffect, useState } from "react";

import { listWorkers, markSiteAttendance } from "@/lib/api/labour";
import { useSiteLabourSummary } from "@/lib/hooks/useWorkers";
import { AttendanceStatus, WorkerListItem } from "@/lib/types/labour";

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half day",
};

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export function SiteLabourPanel({ siteId }: { siteId: string }) {
  const { data: summary, loading, error, refetch } = useSiteLabourSummary(siteId);
  const [workers, setWorkers] = useState<WorkerListItem[]>([]);

  const [workerId, setWorkerId] = useState("");
  const [status, setStatus] = useState<AttendanceStatus>("present");
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [overtime, setOvertime] = useState("");
  const [rate, setRate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    listWorkers({ status: "active", pageSize: 100 }).then((res) => setWorkers(res.items));
  }, []);

  async function handleMark(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!workerId) {
      setFormError("Choose a worker");
      return;
    }
    setSubmitting(true);
    try {
      await markSiteAttendance(siteId, {
        worker_id: workerId,
        work_date: workDate,
        status,
        overtime_hours: overtime ? Number(overtime) : 0,
        wage_rate: rate ? Number(rate) : null,
      });
      setOvertime("");
      setRate("");
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading labour…</p>;
  if (error) return <p className="form-error">{error}</p>;

  const totalWages = summary?.reduce((sum, r) => sum + r.total_wages, 0) ?? 0;

  return (
    <div className="site-team-panel">
      {summary && summary.length > 0 ? (
        <table className="stock-table">
          <thead>
            <tr>
              <th>Worker</th>
              <th>Trade</th>
              <th>Days Present</th>
              <th>Absent</th>
              <th>OT (hrs)</th>
              <th>Wages Payable</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((row) => (
              <tr key={row.worker_id}>
                <td>
                  {row.worker_name} <span className="site-code">({row.worker_code})</span>
                </td>
                <td>{row.trade ?? "—"}</td>
                <td>{row.days_present}</td>
                <td>{row.days_absent}</td>
                <td>{row.total_overtime_hours}</td>
                <td className="stock-on-hand">{inr(row.total_wages)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={5} style={{ textAlign: "right", fontWeight: 600 }}>
                Total wages payable
              </td>
              <td className="stock-on-hand" style={{ fontWeight: 700 }}>
                {inr(totalWages)}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="empty-state">No attendance marked for this site yet.</p>
      )}

      <form onSubmit={handleMark} className="material-entry-form">
        {formError && <p className="form-error">{formError}</p>}
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="att-worker">Worker</label>
            <select id="att-worker" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
              <option value="">Select worker…</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.trade ? `(${w.trade})` : ""} — ₹{Number(w.default_wage_rate).toLocaleString("en-IN")}/day
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="att-status">Status</label>
            <select
              id="att-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
            >
              {(Object.keys(STATUS_LABEL) as AttendanceStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="att-date">Date</label>
            <input
              id="att-date"
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="att-ot">Overtime (hours)</label>
            <input
              id="att-ot"
              type="number"
              min="0"
              step="any"
              value={overtime}
              onChange={(e) => setOvertime(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="att-rate">Day rate override (optional)</label>
          <input
            id="att-rate"
            type="number"
            min="0"
            step="any"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="Leave blank to use the worker's default rate"
          />
        </div>
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "Saving…" : "Mark Attendance"}
        </button>
      </form>
    </div>
  );
}
