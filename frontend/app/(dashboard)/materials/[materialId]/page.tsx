"use client";

import Link from "next/link";

import { archiveMaterial } from "@/lib/api/materials";
import { useMaterial } from "@/lib/hooks/useMaterials";

export default function MaterialDetailPage({ params }: { params: { materialId: string } }) {
  const { data: material, loading, error } = useMaterial(params.materialId);

  if (loading) return <p>Loading material...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!material) return null;

  async function handleArchive() {
    if (!confirm("Archive this material?")) return;
    await archiveMaterial(material!.id);
    window.location.href = "/materials";
  }

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <div>
          <div className="detail-code">{material.code}</div>
          <h1>{material.name}</h1>
        </div>
        <div className="site-actions">
          <span className={`status-badge status-${material.status}`}>{material.status}</span>
          <Link href={`/materials/${material.id}/edit`}>Edit</Link>
          <button type="button" onClick={handleArchive}>
            Archive
          </button>
        </div>
      </div>

      <dl className="site-overview">
        <dt>Status</dt>
        <dd>{material.status}</dd>
        <dt>Unit</dt>
        <dd>{material.unit}</dd>
        <dt>Category</dt>
        <dd>{material.category ?? "—"}</dd>
        {material.notes && (
          <>
            <dt>Notes</dt>
            <dd>{material.notes}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
