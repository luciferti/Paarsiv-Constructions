"use client";

import { useRouter } from "next/navigation";

import { PO_STATUS_LABEL, PurchaseOrderListItem } from "@/lib/types/purchase";

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export function PurchaseOrderTable({ orders }: { orders: PurchaseOrderListItem[] }) {
  const router = useRouter();

  if (orders.length === 0) {
    return <p className="empty-state">No purchase orders yet. Raise one to get started.</p>;
  }

  return (
    <table className="site-table">
      <thead>
        <tr>
          <th>PO Number</th>
          <th>Order Date</th>
          <th>Status</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((po) => (
          <tr key={po.id} onClick={() => router.push(`/purchase-orders/${po.id}`)}>
            <td className="mono cell-code">{po.po_number}</td>
            <td>{po.order_date}</td>
            <td>
              <span className={`status-badge status-${po.status}`}>
                {PO_STATUS_LABEL[po.status]}
              </span>
            </td>
            <td>{inr(po.total_amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
