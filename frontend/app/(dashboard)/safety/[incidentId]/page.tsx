"use client";

import { useCallback, useEffect, useState } from "react";

import { deleteIncident, getIncident, updateIncident } from "@/lib/api/safety";
import {
  Incident,
  INCIDENT_STATUS_LABEL,
  INCIDENT_STATUSES,
  INCIDENT_TYPE_LABEL,
  IncidentStatus,
} from "@/lib/types/safety";

export default function IncidentDetailPage({ params }: { params: { incidentId: string } }) {
  const [inc, setInc] = useState<Incident | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getIncident(params.incidentId)
      .then(setInc)
      .catch((err) => setError(err.message));
  }, [params.incidentId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="form-error">{error}</p>;
  if (!inc) return <p>Loading incident...</p>;

  async function handleStatus(status: IncidentStatus) {
    await updateIncident(inc!.id, { status });
    load();
  }

  async function handleDelete() {
    if (!confirm("Delete this incident record?")) return;
    await deleteIncident(inc!.id);
    window.location.href = "/safety";
  }

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <div>
          <div className="detail-code" style={{ textTransform: "capitalize" }}>
            {inc.severity} · {INCIDENT_TYPE_LABEL[inc.incident_type]}
          </div>
          <h1>{inc.title}</h1>
        </div>
        <div className="site-actions">
          <span className={`status-badge status-${inc.status}`}>{INCIDENT_STATUS_LABEL[inc.status]}</span>
          <button type="button" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </div>

      <dl className="site-overview">
        <dt>Date</dt>
        <dd>{inc.incident_date}</dd>
        <dt>Type</dt>
        <dd>{INCIDENT_TYPE_LABEL[inc.incident_type]}</dd>
        <dt>Severity</dt>
        <dd style={{ textTransform: "capitalize" }}>{inc.severity}</dd>
        <dt>Reported By</dt>
        <dd>{inc.reported_by ?? "—"}</dd>
        <dt>Status</dt>
        <dd>
          <select value={inc.status} onChange={(e) => handleStatus(e.target.value as IncidentStatus)}>
            {INCIDENT_STATUSES.map((s) => (
              <option key={s} value={s}>{INCIDENT_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </dd>
        {inc.description && (
          <>
            <dt>Description</dt>
            <dd>{inc.description}</dd>
          </>
        )}
        {inc.action_taken && (
          <>
            <dt>Action Taken</dt>
            <dd>{inc.action_taken}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
