"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSubcontractors } from "@/lib/hooks/useSubcontract";

export default function SubcontractorsPage() {
  const router = useRouter();
  const { data, loading, error } = useSubcontractors({});

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <h1>Subcontractors</h1>
        <Link href="/subcontractors/new" className="button-primary">
          + New Subcontractor
        </Link>
      </div>

      {loading && <p>Loading subcontractors...</p>}
      {error && <p className="form-error">{error}</p>}
      {data && data.items.length === 0 && (
        <p className="empty-state">No subcontractors yet. Add one to get started.</p>
      )}
      {data && data.items.length > 0 && (
        <table className="site-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Trade</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((s) => (
              <tr key={s.id} onClick={() => router.push(`/subcontractors/${s.id}`)}>
                <td className="mono cell-code">{s.code}</td>
                <td className="cell-name">{s.name}</td>
                <td>{s.trade ?? "—"}</td>
                <td>
                  <span className={`status-badge status-${s.status}`}>
                    {s.status === "active" ? "Active" : "Inactive"}
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
