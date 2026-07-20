"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { addCashEntry, deleteCashEntry, getPettyCashSummary, listCashEntries } from "@/lib/api/expense";
import { CashEntry, CashEntryType, PettyCashSummary } from "@/lib/types/expense";

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;
const EXPENSE_CATEGORIES = ["Transport", "Food", "Fuel", "Tools", "Wages", "Misc"];

export default function PettyCashPage() {
  const [summary, setSummary] = useState<PettyCashSummary | null>(null);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [entryType, setEntryType] = useState<CashEntryType>("expense");
  const [category, setCategory] = useState("Transport");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paidTo, setPaidTo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getPettyCashSummary(), listCashEntries()])
      .then(([s, e]) => {
        setSummary(s);
        setEntries(e);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!amount || Number(amount) <= 0) {
      setFormError("Enter an amount greater than 0");
      return;
    }
    setSubmitting(true);
    try {
      await addCashEntry({
        entry_type: entryType,
        category: entryType === "expense" ? category : null,
        amount: Number(amount),
        entry_date: entryDate,
        paid_to: paidTo || null,
      });
      setAmount("");
      setPaidTo("");
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteCashEntry(id);
    load();
  }

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <h1>Petty Cash</h1>
      </div>

      {loading && <p>Loading petty cash…</p>}
      {error && <p className="form-error">{error}</p>}

      {summary && (
        <div className="budget-cards">
          <div className="budget-card">
            <div className="budget-card-label">Balance in Hand</div>
            <div className={`budget-card-value ${summary.balance < 0 ? "budget-over" : "budget-under"}`}>
              {inr(summary.balance)}
            </div>
          </div>
          <div className="budget-card">
            <div className="budget-card-label">Total Topped Up</div>
            <div className="budget-card-value">{inr(summary.total_topup)}</div>
          </div>
          <div className="budget-card">
            <div className="budget-card-label">Total Spent</div>
            <div className="budget-card-value">{inr(summary.total_expense)}</div>
          </div>
        </div>
      )}

      <form onSubmit={handleAdd} className="material-entry-form">
        {formError && <p className="form-error">{formError}</p>}
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="cash-type">Type</label>
            <select
              id="cash-type"
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as CashEntryType)}
            >
              <option value="expense">Expense (cash out)</option>
              <option value="topup">Top-up (cash in)</option>
            </select>
          </div>
          {entryType === "expense" ? (
            <div className="form-field">
              <label htmlFor="cash-category">Category</label>
              <select id="cash-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="form-field">
              <label htmlFor="cash-paid">Source (optional)</label>
              <input
                id="cash-paid"
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                placeholder="e.g. Office float"
              />
            </div>
          )}
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="cash-amount">Amount (₹)</label>
            <input
              id="cash-amount"
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="cash-date">Date</label>
            <input
              id="cash-date"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>
        </div>
        {entryType === "expense" && (
          <div className="form-field">
            <label htmlFor="cash-paidto">Paid To (optional)</label>
            <input
              id="cash-paidto"
              value={paidTo}
              onChange={(e) => setPaidTo(e.target.value)}
              placeholder="e.g. Auto fare, hardware shop"
            />
          </div>
        )}
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "Saving…" : entryType === "topup" ? "Add Top-up" : "Add Expense"}
        </button>
      </form>

      {entries.length > 0 && (
        <table className="site-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Category / Source</th>
              <th>Paid To</th>
              <th>Amount</th>
              <th aria-label="remove" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{e.entry_date}</td>
                <td>
                  <span className={`status-badge status-${e.entry_type === "topup" ? "active" : "pending_review"}`}>
                    {e.entry_type === "topup" ? "Top-up" : "Expense"}
                  </span>
                </td>
                <td>{e.category ?? "—"}</td>
                <td>{e.paid_to ?? "—"}</td>
                <td className={e.entry_type === "topup" ? "budget-under" : "budget-over"}>
                  {e.entry_type === "topup" ? "+" : "−"}
                  {inr(e.amount)}
                </td>
                <td>
                  <button
                    type="button"
                    className="link-danger"
                    onClick={() => handleDelete(e.id)}
                    aria-label="Delete entry"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
