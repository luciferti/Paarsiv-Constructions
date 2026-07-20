"use client";

import { archiveSubcontractor } from "@/lib/api/subcontract";
import { useSubcontractor } from "@/lib/hooks/useSubcontract";

export default function SubcontractorDetailPage({ params }: { params: { subId: string } }) {
  const { data: sub, loading, error } = useSubcontractor(params.subId);

  if (loading) return <p>Loading subcontractor...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!sub) return null;

  async function handleArchive() {
    if (!confirm("Archive this subcontractor?")) return;
    await archiveSubcontractor(sub!.id);
    window.location.href = "/subcontractors";
  }

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <div>
          <div className="detail-code">{sub.code}</div>
          <h1>{sub.name}</h1>
        </div>
        <div className="site-actions">
          <span className={`status-badge status-${sub.status}`}>{sub.status}</span>
          <button type="button" onClick={handleArchive}>
            Archive
          </button>
        </div>
      </div>

      <dl className="site-overview">
        <dt>Trade / Specialty</dt>
        <dd>{sub.trade ?? "—"}</dd>
        <dt>Contact</dt>
        <dd>{sub.contact_name ?? "—"}</dd>
        <dt>Phone</dt>
        <dd>{sub.phone ?? "—"}</dd>
        {sub.notes && (
          <>
            <dt>Notes</dt>
            <dd>{sub.notes}</dd>
          </>
        )}
      </dl>

      <p className="field-hint" style={{ marginTop: "1rem" }}>
        Raise work orders for this subcontractor from the Work Orders page.
      </p>
    </div>
  );
}
