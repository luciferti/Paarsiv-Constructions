"use client";

import { useRouter } from "next/navigation";

import { MaterialListItem } from "@/lib/types/material";

export function MaterialTable({ materials }: { materials: MaterialListItem[] }) {
  const router = useRouter();

  if (materials.length === 0) {
    return <p className="empty-state">No materials yet. Add one to get started.</p>;
  }

  return (
    <table className="site-table">
      <thead>
        <tr>
          <th>Code</th>
          <th>Name</th>
          <th>Unit</th>
          <th>Category</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {materials.map((material) => (
          <tr key={material.id} onClick={() => router.push(`/materials/${material.id}`)}>
            <td className="mono cell-code">{material.code}</td>
            <td className="cell-name">{material.name}</td>
            <td>{material.unit}</td>
            <td>{material.category ?? "—"}</td>
            <td>
              <span className={`status-badge status-${material.status}`}>
                {material.status === "active" ? "Active" : "Inactive"}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
