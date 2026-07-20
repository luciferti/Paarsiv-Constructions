"use client";

import { cancelPurchaseOrder, updatePurchaseOrder } from "@/lib/api/purchase";
import { usePurchaseOrder } from "@/lib/hooks/usePurchaseOrders";
import { PO_STATUS_LABEL, PO_STATUSES, POStatus } from "@/lib/types/purchase";

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function PurchaseOrderDetailPage({ params }: { params: { poId: string } }) {
  const { data: po, loading, error, refetch } = usePurchaseOrder(params.poId);

  if (loading) return <p>Loading purchase order...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!po) return null;

  async function handleStatusChange(status: POStatus) {
    await updatePurchaseOrder(po!.id, { status });
    refetch();
  }

  async function handleCancel() {
    if (!confirm("Cancel this purchase order?")) return;
    await cancelPurchaseOrder(po!.id);
    window.location.href = "/purchase-orders";
  }

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <div>
          <div className="detail-code">{po.po_number}</div>
          <h1>Purchase Order</h1>
        </div>
        <div className="site-actions">
          <span className={`status-badge status-${po.status}`}>{PO_STATUS_LABEL[po.status]}</span>
          <button type="button" onClick={handleCancel}>
            Cancel PO
          </button>
        </div>
      </div>

      <dl className="site-overview">
        <dt>Order Date</dt>
        <dd>{po.order_date}</dd>
        <dt>Expected Delivery</dt>
        <dd>{po.expected_date ?? "—"}</dd>
        <dt>Status</dt>
        <dd>
          <select
            value={po.status}
            onChange={(e) => handleStatusChange(e.target.value as POStatus)}
            disabled={po.status === "cancelled"}
          >
            {PO_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PO_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </dd>
        {po.notes && (
          <>
            <dt>Notes</dt>
            <dd>{po.notes}</dd>
          </>
        )}
      </dl>

      <section className="form-section">
        <h2 className="form-section-title">Line Items</h2>
        <table className="stock-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.description}</td>
                <td>{line.quantity}</td>
                <td>{line.unit ?? "—"}</td>
                <td>{inr(line.unit_price)}</td>
                <td className="stock-on-hand">{inr(line.line_total)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} style={{ textAlign: "right", fontWeight: 600 }}>
                Order Total
              </td>
              <td className="stock-on-hand" style={{ fontWeight: 700 }}>
                {inr(po.total_amount)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
