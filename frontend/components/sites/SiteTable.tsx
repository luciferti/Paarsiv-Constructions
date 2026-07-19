"use client";

import { useRouter } from "next/navigation";

import { SiteListItem } from "@/lib/types/site";

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  archived: "Archived",
};

export function SiteTable({ sites }: { sites: SiteListItem[] }) {
  const router = useRouter();

  if (sites.length === 0) {
    return <p className="empty-state">No sites yet. Create one to get started.</p>;
  }

  return (
    <table className="site-table">
      <thead>
        <tr>
          <th>Code</th>
          <th>Name</th>
          <th>Location</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {sites.map((site) => (
          <tr key={site.id} onClick={() => router.push(`/sites/${site.id}`)}>
            <td className="mono cell-code">{site.code}</td>
            <td className="cell-name">{site.name}</td>
            <td>{[site.city, site.state].filter(Boolean).join(", ") || "—"}</td>
            <td>
              <span className={`status-badge status-${site.status}`}>
                {STATUS_LABEL[site.status] ?? site.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
