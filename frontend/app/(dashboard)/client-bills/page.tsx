"use client";

import Link from "next/link";
import { useState } from "react";

import { ClientBillTable } from "@/components/billing/ClientBillTable";
import { useClientBills, useClientBillingSummary } from "@/lib/hooks/useClientBills";
import { BILL_STATUS_LABEL, BILL_STATUSES, BillStatus } from "@/lib/types/billing";

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function ClientBillsListPage() {
  const [status, setStatus] = useState<BillStatus | "all">("all");
  const { data, loading, error } = useClientBills({
    status: status === "all" ? undefined : status,
  });
  const { data: summary } = useClientBillingSummary();

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <h1>Client Bills</h1>
        <Link href="/client-bills/new" className="button-primary">
          + New Bill
        </Link>
      </div>

      {summary && (
        <div className="budget-cards">
          <div className="budget-card">
            <div className="budget-card-label">Gross Billed</div>
            <div className="budget-card-value">{inr(summary.total_gross)}</div>
          </div>
          <div className="budget-card">
            <div className="budget-card-label">Received</div>
            <div className="budget-card-value budget-under">{inr(summary.total_paid)}</div>
          </div>
          <div className="budget-card">
            <div className="budget-card-label">Outstanding</div>
            <div className="budget-card-value budget-over">{inr(summary.total_outstanding)}</div>
          </div>
        </div>
      )}

      <div className="sites-filters">
        <button className={status === "all" ? "filter-active" : ""} onClick={() => setStatus("all")}>
          All
        </button>
        {BILL_STATUSES.map((s) => (
          <button key={s} className={s === status ? "filter-active" : ""} onClick={() => setStatus(s)}>
            {BILL_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading && <p>Loading client bills...</p>}
      {error && <p className="form-error">{error}</p>}
      {data && <ClientBillTable bills={data.items} />}
    </div>
  );
}
