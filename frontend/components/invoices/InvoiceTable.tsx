"use client";

import { useRouter } from "next/navigation";

import { Invoice } from "@/lib/types/invoice";

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_CLASS: Record<string, string> = {
  pending_review: "status-planning",
  approved: "status-active",
  rejected: "status-blacklisted",
};

export function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  const router = useRouter();

  if (invoices.length === 0) {
    return <p className="empty-state">No invoices uploaded yet.</p>;
  }

  return (
    <table className="site-table">
      <thead>
        <tr>
          <th>File</th>
          <th>Invoice #</th>
          <th>Date</th>
          <th>Amount</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((invoice) => (
          <tr key={invoice.id} onClick={() => router.push(`/invoices/${invoice.id}`)}>
            <td className="cell-name">{invoice.original_filename}</td>
            <td className="mono cell-code">{invoice.invoice_number ?? "—"}</td>
            <td className="mono cell-code">{invoice.invoice_date ?? "—"}</td>
            <td className="mono">{invoice.amount !== null ? invoice.amount.toFixed(2) : "—"}</td>
            <td>
              <span className={`status-badge ${STATUS_CLASS[invoice.status]}`}>
                {STATUS_LABEL[invoice.status]}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
