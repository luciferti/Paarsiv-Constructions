"use client";

import { useRouter } from "next/navigation";

import { BILL_STATUS_LABEL, ClientBillListRow } from "@/lib/types/billing";

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export function ClientBillTable({ bills }: { bills: ClientBillListRow[] }) {
  const router = useRouter();

  if (bills.length === 0) {
    return <p className="empty-state">No client bills yet. Raise one to get started.</p>;
  }

  return (
    <table className="site-table">
      <thead>
        <tr>
          <th>Bill No.</th>
          <th>Date</th>
          <th>Gross</th>
          <th>Net Payable</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {bills.map((bill) => (
          <tr key={bill.id} onClick={() => router.push(`/client-bills/${bill.id}`)}>
            <td className="mono cell-code">{bill.bill_number}</td>
            <td>{bill.bill_date}</td>
            <td>{inr(bill.gross_amount)}</td>
            <td>{inr(bill.net_payable)}</td>
            <td>
              <span className={`status-badge status-${bill.status}`}>
                {BILL_STATUS_LABEL[bill.status]}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
