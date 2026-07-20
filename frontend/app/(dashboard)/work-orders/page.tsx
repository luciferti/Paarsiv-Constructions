"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useWorkOrders } from "@/lib/hooks/useSubcontract";
import { WO_STATUS_LABEL, WO_STATUSES, WorkOrderStatus } from "@/lib/types/subcontract";

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function WorkOrdersPage() {
  const router = useRouter();
  const [status, setStatus] = useState<WorkOrderStatus | "all">("all");
  const { data, loading, error } = useWorkOrders({
    status: status === "all" ? undefined : status,
  });

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <h1>Work Orders</h1>
        <Link href="/work-orders/new" className="button-primary">
          + New WO
        </Link>
      </div>

      <div className="sites-filters">
        <button className={status === "all" ? "filter-active" : ""} onClick={() => setStatus("all")}>
          All
        </button>
        {WO_STATUSES.map((s) => (
          <button key={s} className={s === status ? "filter-active" : ""} onClick={() => setStatus(s)}>
            {WO_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading && <p>Loading work orders...</p>}
      {error && <p className="form-error">{error}</p>}
      {data && data.items.length === 0 && (
        <p className="empty-state">No work orders yet. Raise one to get started.</p>
      )}
      {data && data.items.length > 0 && (
        <table className="site-table">
          <thead>
            <tr>
              <th>WO No.</th>
              <th>Title</th>
              <th>Value</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Progress</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((wo) => (
              <tr key={wo.id} onClick={() => router.push(`/work-orders/${wo.id}`)}>
                <td className="mono cell-code">{wo.wo_number}</td>
                <td className="cell-name">{wo.title}</td>
                <td>{inr(wo.wo_value)}</td>
                <td>{inr(wo.total_paid)}</td>
                <td>{inr(wo.balance)}</td>
                <td>{wo.progress_percent}%</td>
                <td>
                  <span className={`status-badge status-${wo.status}`}>
                    {WO_STATUS_LABEL[wo.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
