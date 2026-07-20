"use client";

import { FormEvent, useEffect, useState } from "react";

import { listSites } from "@/lib/api/sites";
import { ClientBillFormValues } from "@/lib/types/billing";
import { SiteListItem } from "@/lib/types/site";

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

interface Props {
  onSubmit: (values: ClientBillFormValues) => Promise<void>;
  submitLabel: string;
}

export function ClientBillForm({ onSubmit, submitLabel }: Props) {
  const [sites, setSites] = useState<SiteListItem[]>([]);
  const [siteId, setSiteId] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [gross, setGross] = useState("");
  const [retention, setRetention] = useState("5");
  const [tds, setTds] = useState("2");
  const [other, setOther] = useState("0");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSites({ pageSize: 100 }).then((res) => setSites(res.items));
  }, []);

  const g = Number(gross || 0);
  const retAmt = (g * Number(retention || 0)) / 100;
  const tdsAmt = (g * Number(tds || 0)) / 100;
  const net = g - retAmt - tdsAmt - Number(other || 0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!siteId || !billNumber.trim() || g <= 0) {
      setError("Site, bill number and a gross amount are required");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        site_id: siteId,
        bill_number: billNumber.trim(),
        bill_date: billDate,
        gross_amount: g,
        retention_percent: Number(retention || 0),
        tds_percent: Number(tds || 0),
        other_deductions: Number(other || 0),
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
        <h2 className="form-section-title">Bill</h2>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="bill-site">Site</label>
            <select id="bill-site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">Select site…</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="bill-number">Bill Number</label>
            <input
              id="bill-number"
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
              placeholder="e.g. RA-1"
            />
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="bill-date">Bill Date</label>
            <input id="bill-date" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="bill-gross">Gross Work Value (₹)</label>
            <input
              id="bill-gross"
              type="number"
              min="0"
              step="any"
              value={gross}
              onChange={(e) => setGross(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Deductions</h2>
        <div className="form-grid form-grid-3">
          <div className="form-field">
            <label htmlFor="bill-retention">Retention %</label>
            <input id="bill-retention" type="number" min="0" step="any" value={retention} onChange={(e) => setRetention(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="bill-tds">TDS %</label>
            <input id="bill-tds" type="number" min="0" step="any" value={tds} onChange={(e) => setTds(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="bill-other">Other Deductions (₹)</label>
            <input id="bill-other" type="number" min="0" step="any" value={other} onChange={(e) => setOther(e.target.value)} />
          </div>
        </div>

        <div className="budget-cards" style={{ marginTop: 12 }}>
          <div className="budget-card">
            <div className="budget-card-label">Retention</div>
            <div className="budget-card-value">{inr(retAmt)}</div>
          </div>
          <div className="budget-card">
            <div className="budget-card-label">TDS</div>
            <div className="budget-card-value">{inr(tdsAmt)}</div>
          </div>
          <div className="budget-card">
            <div className="budget-card-label">Net Payable</div>
            <div className="budget-card-value budget-under">{inr(net)}</div>
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Notes</h2>
        <div className="form-field">
          <textarea id="bill-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
