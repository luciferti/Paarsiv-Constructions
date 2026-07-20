"use client";

import { FormEvent, useState } from "react";

import { addWorkOrderPayment, deleteWorkOrder, updateWorkOrder } from "@/lib/api/subcontract";
import { useWorkOrder } from "@/lib/hooks/useSubcontract";
import { WO_STATUS_LABEL, WO_STATUSES, WorkOrderStatus } from "@/lib/types/subcontract";

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function WorkOrderDetailPage({ params }: { params: { woId: string } }) {
  const { data: wo, loading, error, refetch } = useWorkOrder(params.woId);
  const [amount, setAmount] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [progress, setProgress] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  if (loading) return <p>Loading work order...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!wo) return null;

  async function handleStatus(status: WorkOrderStatus) {
    await updateWorkOrder(wo!.id, { status });
    refetch();
  }

  async function handleProgress() {
    const p = Number(progress);
    if (progress === "" || p < 0 || p > 100) {
      setFormError("Progress must be between 0 and 100");
      return;
    }
    setFormError(null);
    await updateWorkOrder(wo!.id, { progress_percent: p });
    setProgress("");
    refetch();
  }

  async function handleAddPayment(event: FormEvent) {
    event.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setFormError("Enter a payment amount");
      return;
    }
    setFormError(null);
    await addWorkOrderPayment(wo!.id, { amount: Number(amount), payment_date: payDate });
    setAmount("");
    refetch();
  }

  async function handleDelete() {
    if (!confirm("Delete this work order?")) return;
    await deleteWorkOrder(wo!.id);
    window.location.href = "/work-orders";
  }

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <div>
          <div className="detail-code">{wo.wo_number}</div>
          <h1>{wo.title}</h1>
        </div>
        <div className="site-actions">
          <span className={`status-badge status-${wo.status}`}>{WO_STATUS_LABEL[wo.status]}</span>
          <button type="button" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      <div className="budget-cards">
        <div className="budget-card">
          <div className="budget-card-label">WO Value</div>
          <div className="budget-card-value">{inr(wo.wo_value)}</div>
        </div>
        <div className="budget-card">
          <div className="budget-card-label">Paid</div>
          <div className="budget-card-value budget-under">{inr(wo.total_paid)}</div>
        </div>
        <div className="budget-card">
          <div className="budget-card-label">Balance</div>
          <div className="budget-card-value budget-over">{inr(wo.balance)}</div>
        </div>
      </div>

      <div className="budget-bar" aria-label={`${wo.progress_percent}% complete`}>
        <div className="budget-bar-fill" style={{ width: `${Math.min(wo.progress_percent, 100)}%` }} />
        <span className="budget-bar-text">{wo.progress_percent}% complete</span>
      </div>

      <dl className="site-overview">
        <dt>Order Date</dt>
        <dd>{wo.order_date}</dd>
        <dt>Status</dt>
        <dd>
          <select value={wo.status} onChange={(e) => handleStatus(e.target.value as WorkOrderStatus)}>
            {WO_STATUSES.map((s) => (
              <option key={s} value={s}>
                {WO_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </dd>
        <dt>Update Progress</dt>
        <dd style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            min="0"
            max="100"
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
            placeholder={`${wo.progress_percent}`}
            style={{ width: "6rem" }}
          />
          <button type="button" className="button-secondary" onClick={handleProgress}>
            Set %
          </button>
        </dd>
      </dl>

      {formError && <p className="form-error">{formError}</p>}

      <section className="form-section">
        <h2 className="form-section-title">Payments</h2>
        {wo.payments.length > 0 ? (
          <table className="stock-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {wo.payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.payment_date}</td>
                  <td className="stock-on-hand">{inr(p.amount)}</td>
                  <td>{p.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty-state">No payments logged yet.</p>
        )}

        <form onSubmit={handleAddPayment} className="material-entry-form">
          <div className="form-grid form-grid-2">
            <div className="form-field">
              <label htmlFor="wo-pay-amount">Payment Amount (₹)</label>
              <input id="wo-pay-amount" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="wo-pay-date">Date</label>
              <input id="wo-pay-date" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="button-primary">
            Log Payment
          </button>
        </form>
      </section>
    </div>
  );
}
