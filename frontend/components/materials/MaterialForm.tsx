"use client";

import { FormEvent, useState } from "react";

import { MaterialFormValues, MaterialStatus } from "@/lib/types/material";

const STATUS_OPTIONS: MaterialStatus[] = ["active", "inactive"];

function normalizeEmptyStrings(values: MaterialFormValues): MaterialFormValues {
  const normalized = { ...values } as Record<string, unknown>;
  for (const [key, value] of Object.entries(normalized)) {
    if (value === "") normalized[key] = null;
  }
  return normalized as unknown as MaterialFormValues;
}

interface MaterialFormProps {
  initialValues?: Partial<MaterialFormValues>;
  submitLabel: string;
  onSubmit: (values: MaterialFormValues) => Promise<void>;
  codeEditable?: boolean;
}

export function MaterialForm({
  initialValues,
  submitLabel,
  onSubmit,
  codeEditable = true,
}: MaterialFormProps) {
  const [values, setValues] = useState<MaterialFormValues>({
    name: initialValues?.name ?? "",
    code: initialValues?.code ?? "",
    unit: initialValues?.unit ?? "",
    category: initialValues?.category ?? "",
    status: initialValues?.status ?? "active",
    notes: initialValues?.notes ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof MaterialFormValues>(key: K, value: MaterialFormValues[K]) {
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
            <label htmlFor="material-name">Name</label>
            <input
              id="material-name"
              required
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Cement"
            />
          </div>
          <div className="form-field">
            <label htmlFor="material-code">Code</label>
            <input
              id="material-code"
              required
              value={values.code}
              disabled={!codeEditable}
              onChange={(e) => update("code", e.target.value)}
              placeholder="e.g. CEM-01"
            />
            {!codeEditable && <p className="field-hint">Code can&apos;t be changed after creation.</p>}
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="material-unit">Unit</label>
            <input
              id="material-unit"
              required
              value={values.unit}
              onChange={(e) => update("unit", e.target.value)}
              placeholder="e.g. bag, kg, cum"
            />
          </div>
          <div className="form-field">
            <label htmlFor="material-category">Category</label>
            <input
              id="material-category"
              value={values.category ?? ""}
              onChange={(e) => update("category", e.target.value)}
              placeholder="e.g. Structural"
            />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="material-status">Status</label>
          <select
            id="material-status"
            value={values.status}
            onChange={(e) => update("status", e.target.value as MaterialStatus)}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === "active" ? "Active" : "Inactive"}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Notes</h2>
        <div className="form-field">
          <textarea
            id="material-notes"
            rows={3}
            value={values.notes ?? ""}
            onChange={(e) => update("notes", e.target.value)}
          />
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
