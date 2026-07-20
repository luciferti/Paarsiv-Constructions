"use client";

import { FormEvent, useState } from "react";

import { SubcontractorFormValues, SubcontractorStatus } from "@/lib/types/subcontract";

function normalizeEmptyStrings(values: SubcontractorFormValues): SubcontractorFormValues {
  const normalized = { ...values } as Record<string, unknown>;
  for (const [key, value] of Object.entries(normalized)) {
    if (value === "") normalized[key] = null;
  }
  return normalized as unknown as SubcontractorFormValues;
}

interface Props {
  initialValues?: Partial<SubcontractorFormValues>;
  submitLabel: string;
  onSubmit: (values: SubcontractorFormValues) => Promise<void>;
  codeEditable?: boolean;
}

export function SubcontractorForm({ initialValues, submitLabel, onSubmit, codeEditable = true }: Props) {
  const [values, setValues] = useState<SubcontractorFormValues>({
    name: initialValues?.name ?? "",
    code: initialValues?.code ?? "",
    trade: initialValues?.trade ?? "",
    contact_name: initialValues?.contact_name ?? "",
    phone: initialValues?.phone ?? "",
    status: initialValues?.status ?? "active",
    notes: initialValues?.notes ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof SubcontractorFormValues>(key: K, value: SubcontractorFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(normalizeEmptyStrings(values));
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
        <h2 className="form-section-title">Basics</h2>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="sc-name">Name</label>
            <input id="sc-name" required value={values.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Sharma Tiling Works" />
          </div>
          <div className="form-field">
            <label htmlFor="sc-code">Code</label>
            <input id="sc-code" required value={values.code} disabled={!codeEditable} onChange={(e) => update("code", e.target.value)} placeholder="e.g. SC-01" />
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="sc-trade">Trade / Specialty</label>
            <input id="sc-trade" value={values.trade ?? ""} onChange={(e) => update("trade", e.target.value)} placeholder="e.g. Tiling, Plumbing, RCC" />
          </div>
          <div className="form-field">
            <label htmlFor="sc-status">Status</label>
            <select id="sc-status" value={values.status} onChange={(e) => update("status", e.target.value as SubcontractorStatus)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="sc-contact">Contact Name</label>
            <input id="sc-contact" value={values.contact_name ?? ""} onChange={(e) => update("contact_name", e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="sc-phone">Phone</label>
            <input id="sc-phone" value={values.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
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
