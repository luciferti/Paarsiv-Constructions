"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  addSiteBudgetLine,
  deleteSiteBudgetLine,
  getSiteBudgetSummary,
  listSiteBudgetLines,
} from "@/lib/api/budget";
import { BudgetLine, SiteBudgetSummary } from "@/lib/types/budget";

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;
const CATEGORIES = ["Material", "Labour", "Equipment", "Subcontract", "Overhead", "Other"];

export function SiteBudgetPanel({ siteId }: { siteId: string }) {
  const [summary, setSummary] = useState<SiteBudgetSummary | null>(null);
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState("Material");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getSiteBudgetSummary(siteId), listSiteBudgetLines(siteId)])
      .then(([s, l]) => {
        setSummary(s);
        setLines(l);
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
    if (!amount || Number(amount) < 0) {
      setFormError("Enter a budget amount");
      return;
    }
    setSubmitting(true);
    try {
      await addSiteBudgetLine(siteId, {
        category,
        description: description || null,
        budgeted_amount: Number(amount),
      });
      setDescription("");
      setAmount("");
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(lineId: string) {
    await deleteSiteBudgetLine(siteId, lineId);
    load();
  }

  if (loading) return <p>Loading budget…</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!summary) return null;

  const over = summary.variance < 0;
  const pct = Math.min(summary.percent_used, 100);

  return (
    <div className="site-team-panel">
      <div className="budget-cards">
        <div className="budget-card">
          <div className="budget-card-label">Budget</div>
          <div className="budget-card-value">{inr(summary.total_budgeted)}</div>
        </div>
        <div className="budget-card">
          <div className="budget-card-label">Actual Spent</div>
          <div className="budget-card-value">{inr(summary.actual_total)}</div>
        </div>
        <div className="budget-card">
          <div className="budget-card-label">{over ? "Over budget by" : "Remaining"}</div>
          <div className={`budget-card-value ${over ? "budget-over" : "budget-under"}`}>
            {inr(Math.abs(summary.variance))}
          </div>
        </div>
      </div>

      <div className="budget-bar" aria-label={`${summary.percent_used}% of budget used`}>
        <div
          className={`budget-bar-fill ${over ? "budget-over-fill" : ""}`}
          style={{ width: `${pct}%` }}
        />
        <span className="budget-bar-text">{summary.percent_used}% used</span>
      </div>

      <table className="stock-table">
        <thead>
          <tr>
            <th>Actual breakdown</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Materials (received)</td>
            <td>{inr(summary.actual_material)}</td>
          </tr>
          <tr>
            <td>Labour (wages)</td>
            <td>{inr(summary.actual_labour)}</td>
          </tr>
          <tr>
            <td>Invoices (approved)</td>
            <td>{inr(summary.actual_invoices)}</td>
          </tr>
        </tbody>
      </table>

      {lines.length > 0 && (
        <table className="stock-table">
          <thead>
            <tr>
              <th>Budget line</th>
              <th>Category</th>
              <th>Amount</th>
              <th aria-label="remove" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id}>
                <td>{line.description ?? "—"}</td>
                <td>{line.category}</td>
                <td>{inr(line.budgeted_amount)}</td>
                <td>
                  <button
                    type="button"
                    className="link-danger"
                    onClick={() => handleDelete(line.id)}
                    aria-label="Delete budget line"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={handleAdd} className="material-entry-form">
        {formError && <p className="form-error">{formError}</p>}
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="budget-category">Category</label>
            <select id="budget-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="budget-amount">Budgeted Amount (₹)</label>
            <input
              id="budget-amount"
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="budget-desc">Description (optional)</label>
          <input
            id="budget-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Structural cement & steel"
          />
        </div>
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "Adding…" : "Add Budget Line"}
        </button>
      </form>
    </div>
  );
}
