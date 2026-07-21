"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { listEquipment } from "@/lib/api/equipment";
import { EQUIPMENT_STATUS_LABEL, EquipmentListItem } from "@/lib/types/equipment";

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function EquipmentPage() {
  const router = useRouter();
  const [items, setItems] = useState<EquipmentListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listEquipment({})
      .then((res) => setItems(res.items))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <h1>Equipment</h1>
        <Link href="/equipment/new" className="button-primary">
          + New Equipment
        </Link>
      </div>

      {error && <p className="form-error">{error}</p>}
      {!items && !error && <p>Loading equipment...</p>}
      {items && items.length === 0 && (
        <p className="empty-state">No equipment yet. Add machinery to get started.</p>
      )}
      {items && items.length > 0 && (
        <table className="site-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Ownership</th>
              <th>Rate</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} onClick={() => router.push(`/equipment/${e.id}`)}>
                <td className="mono cell-code">{e.code}</td>
                <td className="cell-name">{e.name}</td>
                <td>{e.category ?? "—"}</td>
                <td style={{ textTransform: "capitalize" }}>{e.ownership}</td>
                <td>{e.rental_rate ? inr(e.rental_rate) : "—"}</td>
                <td>
                  <span className={`status-badge status-${e.status}`}>
                    {EQUIPMENT_STATUS_LABEL[e.status]}
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
