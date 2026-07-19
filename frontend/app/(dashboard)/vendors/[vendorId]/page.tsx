"use client";

import Link from "next/link";

import { archiveVendor } from "@/lib/api/vendors";
import { useVendor } from "@/lib/hooks/useVendors";

export default function VendorDetailPage({ params }: { params: { vendorId: string } }) {
  const { data: vendor, loading, error } = useVendor(params.vendorId);

  if (loading) return <p>Loading vendor...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!vendor) return null;

  async function handleArchive() {
    if (!confirm("Archive this vendor?")) return;
    await archiveVendor(vendor!.id);
    window.location.href = "/vendors";
  }

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <div>
          <div className="detail-code">{vendor.code}</div>
          <h1>{vendor.name}</h1>
        </div>
        <div className="site-actions">
          <span className={`status-badge status-${vendor.status}`}>{vendor.status}</span>
          <Link href={`/vendors/${vendor.id}/edit`}>Edit</Link>
          <button type="button" onClick={handleArchive}>
            Archive
          </button>
        </div>
      </div>

      <dl className="site-overview">
        <dt>Status</dt>
        <dd>{vendor.status}</dd>
        <dt>Category</dt>
        <dd>{vendor.category ?? "—"}</dd>
        <dt>Contact</dt>
        <dd>{vendor.contact_name ?? "—"}</dd>
        <dt>Phone</dt>
        <dd>{vendor.phone ?? "—"}</dd>
        <dt>Email</dt>
        <dd>{vendor.email ?? "—"}</dd>
        <dt>Location</dt>
        <dd>
          {[vendor.address_line, vendor.city, vendor.state, vendor.country]
            .filter(Boolean)
            .join(", ") || "—"}
        </dd>
        <dt>Tax ID</dt>
        <dd>{vendor.tax_id ?? "—"}</dd>
        {vendor.notes && (
          <>
            <dt>Notes</dt>
            <dd>{vendor.notes}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
