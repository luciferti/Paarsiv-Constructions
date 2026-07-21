"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { addMilestone, deleteMilestone, getSiteProgress, updateMilestone } from "@/lib/api/progress";
import {
  MILESTONE_STATUS_LABEL,
  MILESTONE_STATUSES,
  MilestoneStatus,
  SiteProgressSummary,
} from "@/lib/types/progress";

export function SiteProgressPanel({ siteId }: { siteId: string }) {
  const [summary, setSummary] = useState<SiteProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [weight, setWeight] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getSiteProgress(siteId)
      .then((s) => {
        setSummary(s);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!title.trim()) {
      setFormError("Enter a milestone title");
      return;
    }
    setSubmitting(true);
    try {
      await addMilestone(siteId, {
        title: title.trim(),
        target_date: targetDate || null,
        weight: Number(weight) || 1,
      });
      setTitle("");
      setTargetDate("");
      setWeight("1");
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProgress(id: string, value: number) {
    await updateMilestone(siteId, id, { progress_percent: value });
    load();
  }

  async function handleStatus(id: string, status: MilestoneStatus) {
    const patch: { status: MilestoneStatus; actual_date?: string } = { status };
    if (status === "completed") patch.actual_date = new Date().toISOString().slice(0, 10);
    await updateMilestone(siteId, id, patch);
    load();
  }

  async function handleDelete(id: string) {
    await deleteMilestone(siteId, id);
    load();
  }

  if (loading) return <p>Loading progress…</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!summary) return null;

  return (
    <div className="site-team-panel">
      <div className="budget-cards">
        <div className="budget-card">
          <div className="budget-card-label">Overall Progress</div>
          <div className="budget-card-value">{summary.overall_percent}%</div>
        </div>
        <div className="budget-card">
          <div className="budget-card-label">Milestones</div>
          <div className="budget-card-value">{summary.milestone_count}</div>
        </div>
        <div className="budget-card">
          <div className="budget-card-label">Completed</div>
          <div className="budget-card-value budget-under">{summary.by_status.completed ?? 0}</div>
        </div>
      </div>

      <div className="budget-bar" aria-label={`${summary.overall_percent}% overall`}>
        <div className="budget-bar-fill" style={{ width: `${Math.min(summary.overall_percent, 100)}%` }} />
        <span className="budget-bar-text">{summary.overall_percent}% overall</span>
      </div>

      {summary.milestones.length > 0 ? (
        <table className="stock-table">
          <thead>
            <tr>
              <th>Milestone</th>
              <th>Target</th>
              <th>Progress</th>
              <th>Status</th>
              <th aria-label="remove" />
            </tr>
          </thead>
          <tbody>
            {summary.milestones.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.title}
                  {m.weight > 1 && <span className="site-code"> ×{m.weight}</span>}
                </td>
                <td>{m.target_date ?? "—"}</td>
                <td>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={m.progress_percent}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== m.progress_percent && v >= 0 && v <= 100) handleProgress(m.id, v);
                    }}
                    style={{ width: "5rem" }}
                    aria-label={`${m.title} progress`}
                  />
                  %
                </td>
                <td>
                  <select
                    value={m.status}
                    onChange={(e) => handleStatus(m.id, e.target.value as MilestoneStatus)}
                    aria-label={`${m.title} status`}
                  >
                    {MILESTONE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {MILESTONE_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button type="button" className="link-danger" onClick={() => handleDelete(m.id)} aria-label="Delete milestone">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-state">No milestones yet. Add the first one below.</p>
      )}

      <form onSubmit={handleAdd} className="material-entry-form">
        {formError && <p className="form-error">{formError}</p>}
        <div className="form-grid form-grid-3">
          <div className="form-field">
            <label htmlFor="ms-title">Milestone</label>
            <input id="ms-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Foundation complete" />
          </div>
          <div className="form-field">
            <label htmlFor="ms-target">Target Date</label>
            <input id="ms-target" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="ms-weight">Weight</label>
            <input id="ms-weight" type="number" min="1" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "Adding…" : "Add Milestone"}
        </button>
      </form>
    </div>
  );
}
