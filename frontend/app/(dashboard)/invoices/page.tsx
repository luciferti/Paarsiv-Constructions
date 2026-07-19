"use client";

import Link from "next/link";
import { useState } from "react";

import { InvoiceTable } from "@/components/invoices/InvoiceTable";
import { useInvoices } from "@/lib/hooks/useInvoices";
import { InvoiceStatus } from "@/lib/types/invoice";

const STATUS_FILTERS: (InvoiceStatus | "all")[] = ["all", "pending_review", "approved", "rejected"];

const STATUS_FILTER_LABEL: Record<InvoiceStatus | "all", string> = {
  all: "All",
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
};

export default function InvoicesListPage() {
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");
  const { data, loading, error } = useInvoices({
    status: status === "all" ? undefined : status,
  });

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <h1>Invoices</h1>
        <Link href="/invoices/upload" className="button-primary">
          + Upload Invoice
        </Link>
      </div>

      <div className="sites-filters">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter}
            className={filter === status ? "filter-active" : ""}
            onClick={() => setStatus(filter)}
          >
            {STATUS_FILTER_LABEL[filter]}
          </button>
        ))}
      </div>

      {loading && <p>Loading invoices...</p>}
      {error && <p className="form-error">{error}</p>}
      {data && <InvoiceTable invoices={data.items} />}
    </div>
  );
}
