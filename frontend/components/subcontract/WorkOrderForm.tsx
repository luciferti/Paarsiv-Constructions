"use client";

import { FormEvent, useEffect, useState } from "react";

import { listSites } from "@/lib/api/sites";
import { listSubcontractors } from "@/lib/api/subcontract";
import { SiteListItem } from "@/lib/types/site";
import { SubcontractorListItem, WorkOrderFormValues } from "@/lib/types/subcontract";

interface Props {
  onSubmit: (values: WorkOrderFormValues) => Promise<void>;
  submitLabel: string;
}

export function WorkOrderForm({ onSubmit, submitLabel }: Props) {
  const [sites, setSites] = useState<SiteListItem[]>([]);
  const [subs, setSubs] = useState<SubcontractorListItem[]>([]);

  const [woNumber, setWoNumber] = useState("");
  const [siteId, setSiteId] = useState("");
  const [subId, setSubId] = useState("");
  const [title, setTitle] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSites({ pageSize: 100 }).then((res) => setSites(res.items));
    listSubcontractors({ status: "active" }).then((res) => setSubs(res.items));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!woNumber.trim() || !siteId || !subId || !title.trim() || Number(value) <= 0) {
      setError("WO number, site, subcontractor, title and a value are required");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        wo_number: woNumber.trim(),
        site_id: siteId,
        subcontractor_id: subId,
        title: title.trim(),
        order_date: orderDate,
        wo_value: Number(value),
        notes: notes || null,
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
        <h2 className="form-section-title">Work Order</h2>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="wo-number">WO Number</label>
            <input id="wo-number" value={woNumber} onChange={(e) => setWoNumber(e.target.value)} placeholder="e.g. WO-01" />
          </div>
          <div className="form-field">
            <label htmlFor="wo-value">WO Value (₹)</label>
            <input id="wo-value" type="number" min="0" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="wo-site">Site</label>
            <select id="wo-site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">Select site…</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="wo-sub">Subcontractor</label>
            <select id="wo-sub" value={subId} onChange={(e) => setSubId(e.target.value)}>
              <option value="">Select subcontractor…</option>
              {subs.map((s) => (
                <option key={s.id} value={s.id}>{s.name} {s.trade ? `(${s.trade})` : ""}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="wo-title">Scope / Title</label>
            <input id="wo-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 2nd floor tiling" />
          </div>
          <div className="form-field">
            <label htmlFor="wo-date">Order Date</label>
            <input id="wo-date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="wo-notes">Notes</label>
          <textarea id="wo-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
