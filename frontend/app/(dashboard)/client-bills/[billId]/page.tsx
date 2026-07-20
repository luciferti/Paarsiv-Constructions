"use client";

import { deleteClientBill, updateClientBill } from "@/lib/api/billing";
import { useClientBill } from "@/lib/hooks/useClientBills";
import { BILL_STATUS_LABEL, BILL_STATUSES, BillStatus } from "@/lib/types/billing";

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function ClientBillDetailPage({ params }: { params: { billId: string } }) {
  const { data: bill, loading, error, refetch } = useClientBill(params.billId);

  if (loading) return <p>Loading bill...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!bill) return null;

  async function handleStatus(status: BillStatus) {
    await updateClientBill(bill!.id, { status });
    refetch();
  }

  async function handleDelete() {
    if (!confirm("Delete this bill?")) return;
    await deleteClientBill(bill!.id);
    window.location.href = "/client-bills";
  }

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <div>
          <div className="detail-code">{bill.bill_number}</div>
          <h1>Client Bill</h1>
        </div>
        <div className="site-actions">
          <span className={`status-badge status-${bill.status}`}>{BILL_STATUS_LABEL[bill.status]}</span>
          <button type="button" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      <div className="budget-cards">
        <div className="budget-card">
          <div className="budget-card-label">Gross Value</div>
          <div className="budget-card-value">{inr(bill.gross_amount)}</div>
        </div>
        <div className="budget-card">
          <div className="budget-card-label">Total Deductions</div>
          <div className="budget-card-value budget-over">
            {inr(bill.retention_amount + bill.tds_amount + bill.other_deductions)}
          </div>
        </div>
        <div className="budget-card">
          <div className="budget-card-label">Net Payable</div>
          <div className="budget-card-value budget-under">{inr(bill.net_payable)}</div>
        </div>
      </div>

      <dl className="site-overview">
        <dt>Bill Date</dt>
        <dd>{bill.bill_date}</dd>
        <dt>Retention</dt>
        <dd>
          {bill.retention_percent}% — {inr(bill.retention_amount)}
        </dd>
        <dt>TDS</dt>
        <dd>
          {bill.tds_percent}% — {inr(bill.tds_amount)}
        </dd>
        <dt>Other Deductions</dt>
        <dd>{inr(bill.other_deductions)}</dd>
        <dt>Status</dt>
        <dd>
          <select value={bill.status} onChange={(e) => handleStatus(e.target.value as BillStatus)}>
            {BILL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BILL_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </dd>
        {bill.notes && (
          <>
            <dt>Notes</dt>
            <dd>{bill.notes}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
