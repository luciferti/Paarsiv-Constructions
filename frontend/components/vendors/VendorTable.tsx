"use client";

import { useRouter } from "next/navigation";

import { VendorListItem } from "@/lib/types/vendor";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  blacklisted: "Blacklisted",
};

export function VendorTable({ vendors }: { vendors: VendorListItem[] }) {
  const router = useRouter();

  if (vendors.length === 0) {
    return <p className="empty-state">No vendors yet. Add one to get started.</p>;
  }

  return (
    <table className="site-table">
      <thead>
        <tr>
          <th>Code</th>
          <th>Name</th>
          <th>Category</th>
          <th>Contact</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {vendors.map((vendor) => (
          <tr key={vendor.id} onClick={() => router.push(`/vendors/${vendor.id}`)}>
            <td className="mono cell-code">{vendor.code}</td>
            <td className="cell-name">{vendor.name}</td>
            <td>{vendor.category ?? "—"}</td>
            <td>{vendor.phone ?? vendor.email ?? "—"}</td>
            <td>
              <span className={`status-badge status-${vendor.status}`}>
                {STATUS_LABEL[vendor.status] ?? vendor.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
