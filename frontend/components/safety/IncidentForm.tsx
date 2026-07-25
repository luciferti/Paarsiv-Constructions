"use client";

import { FormEvent, useEffect, useState } from "react";

import { listSites } from "@/lib/api/sites";
import { SiteListItem } from "@/lib/types/site";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_TYPE_LABEL,
  INCIDENT_TYPES,
  IncidentFormValues,
  IncidentSeverity,
  IncidentType,
} from "@/lib/types/safety";

interface Props {
  onSubmit: (values: IncidentFormValues) => Promise<void>;
  submitLabel: string;
}

export function IncidentForm({ onSubmit, submitLabel }: Props) {
  const [sites, setSites] = useState<SiteListItem[]>([]);
  const [siteId, setSiteId] = useState("");
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [incidentType, setIncidentType] = useState<IncidentType>("near_miss");
  const [severity, setSeverity] = useState<IncidentSeverity>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSites({ pageSize: 100 }).then((res) => setSites(res.items));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!siteId || !title.trim()) {
      setError("Site and a short title are required");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        site_id: siteId,
        incident_date: incidentDate,
        incident_type: incidentType,
        severity,
        title: title.trim(),
        description: description || null,
        action_taken: actionTaken || null,
        reported_by: reportedBy || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="site-form" noValidate>
      {error && <p className="form-banner-error">{error}</p>}
      <section className="form-section">
        <h2 className="form-section-title">Incident</h2>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="inc-site">Site</label>
            <select id="inc-site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">Select site…</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="inc-date">Date</label>
            <input id="inc-date" type="date" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} />
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="inc-type">Type</label>
            <select id="inc-type" value={incidentType} onChange={(e) => setIncidentType(e.target.value as IncidentType)}>
              {INCIDENT_TYPES.map((t) => (
                <option key={t} value={t}>{INCIDENT_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="inc-severity">Severity</label>
            <select id="inc-severity" value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}>
              {INCIDENT_SEVERITIES.map((s) => (
                <option key={s} value={s} style={{ textTransform: "capitalize" }}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="inc-title">Title</label>
          <input id="inc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Worker slipped near wet scaffold" />
        </div>
        <div className="form-field">
          <label htmlFor="inc-desc">Description</label>
          <textarea id="inc-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="inc-action">Action Taken</label>
            <input id="inc-action" value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="inc-reporter">Reported By</label>
            <input id="inc-reporter" value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} />
          </div>
        </div>
      </section>
      <div className="form-actions">
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
