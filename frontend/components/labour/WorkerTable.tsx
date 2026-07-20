"use client";

import { useRouter } from "next/navigation";

import { WorkerListItem } from "@/lib/types/labour";

export function WorkerTable({ workers }: { workers: WorkerListItem[] }) {
  const router = useRouter();

  if (workers.length === 0) {
    return <p className="empty-state">No workers yet. Add one to get started.</p>;
  }

  return (
    <table className="site-table">
      <thead>
        <tr>
          <th>Code</th>
          <th>Name</th>
          <th>Trade</th>
          <th>Day Rate</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {workers.map((worker) => (
          <tr key={worker.id} onClick={() => router.push(`/workers/${worker.id}`)}>
            <td className="mono cell-code">{worker.code}</td>
            <td className="cell-name">{worker.name}</td>
            <td>{worker.trade ?? "—"}</td>
            <td>₹{Number(worker.default_wage_rate).toLocaleString("en-IN")}</td>
            <td>
              <span className={`status-badge status-${worker.status}`}>
                {worker.status === "active" ? "Active" : "Inactive"}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
