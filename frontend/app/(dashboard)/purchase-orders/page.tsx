"use client";

import Link from "next/link";
import { useState } from "react";

import { PurchaseOrderTable } from "@/components/purchase/PurchaseOrderTable";
import { usePurchaseOrders } from "@/lib/hooks/usePurchaseOrders";
import { PO_STATUS_LABEL, PO_STATUSES, POStatus } from "@/lib/types/purchase";

export default function PurchaseOrdersListPage() {
  const [status, setStatus] = useState<POStatus | "all">("all");
  const { data, loading, error } = usePurchaseOrders({
    status: status === "all" ? undefined : status,
  });

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <h1>Purchase Orders</h1>
        <Link href="/purchase-orders/new" className="button-primary">
          + New PO
        </Link>
      </div>

      <div className="sites-filters">
        <button className={status === "all" ? "filter-active" : ""} onClick={() => setStatus("all")}>
          All
        </button>
        {PO_STATUSES.map((s) => (
          <button key={s} className={s === status ? "filter-active" : ""} onClick={() => setStatus(s)}>
            {PO_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading && <p>Loading purchase orders...</p>}
      {error && <p className="form-error">{error}</p>}
      {data && <PurchaseOrderTable orders={data.items} />}
    </div>
  );
}
