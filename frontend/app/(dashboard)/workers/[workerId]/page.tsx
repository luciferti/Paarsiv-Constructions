"use client";

import Link from "next/link";

import { archiveWorker } from "@/lib/api/labour";
import { useWorker } from "@/lib/hooks/useWorkers";

export default function WorkerDetailPage({ params }: { params: { workerId: string } }) {
  const { data: worker, loading, error } = useWorker(params.workerId);

  if (loading) return <p>Loading worker...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!worker) return null;

  async function handleArchive() {
    if (!confirm("Archive this worker?")) return;
    await archiveWorker(worker!.id);
    window.location.href = "/workers";
  }

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <div>
          <div className="detail-code">{worker.code}</div>
          <h1>{worker.name}</h1>
        </div>
        <div className="site-actions">
          <span className={`status-badge status-${worker.status}`}>{worker.status}</span>
          <Link href={`/workers/${worker.id}/edit`}>Edit</Link>
          <button type="button" onClick={handleArchive}>
            Archive
          </button>
        </div>
      </div>

      <dl className="site-overview">
        <dt>Trade / Skill</dt>
        <dd>{worker.trade ?? "—"}</dd>
        <dt>Phone</dt>
        <dd>{worker.phone ?? "—"}</dd>
        <dt>Default Day Rate</dt>
        <dd>₹{Number(worker.default_wage_rate).toLocaleString("en-IN")}</dd>
        <dt>Status</dt>
        <dd>{worker.status}</dd>
        {worker.notes && (
          <>
            <dt>Notes</dt>
            <dd>{worker.notes}</dd>
          </>
        )}
      </dl>

      <p className="field-hint" style={{ marginTop: "1rem" }}>
        Mark this worker&apos;s daily attendance from a site → Labour tab.
      </p>
    </div>
  );
}
