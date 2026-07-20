"use client";

import { FormEvent, useState } from "react";

import { WorkerFormValues, WorkerStatus } from "@/lib/types/labour";

const STATUS_OPTIONS: WorkerStatus[] = ["active", "inactive"];

function normalizeEmptyStrings(values: WorkerFormValues): WorkerFormValues {
  const normalized = { ...values } as Record<string, unknown>;
  for (const [key, value] of Object.entries(normalized)) {
    if (value === "") normalized[key] = null;
  }
  return normalized as unknown as WorkerFormValues;
}

interface WorkerFormProps {
  initialValues?: Partial<WorkerFormValues>;
  submitLabel: string;
  onSubmit: (values: WorkerFormValues) => Promise<void>;
  codeEditable?: boolean;
}

export function WorkerForm({
  initialValues,
  submitLabel,
  onSubmit,
  codeEditable = true,
}: WorkerFormProps) {
  const [values, setValues] = useState<WorkerFormValues>({
    name: initialValues?.name ?? "",
    code: initialValues?.code ?? "",
    phone: initialValues?.phone ?? "",
    trade: initialValues?.trade ?? "",
    default_wage_rate: initialValues?.default_wage_rate ?? 0,
    status: initialValues?.status ?? "active",
    notes: initialValues?.notes ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof WorkerFormValues>(key: K, value: WorkerFormValues[K]) {
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
            <label htmlFor="worker-name">Name</label>
            <input
              id="worker-name"
              required
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Ramesh Kumar"
            />
          </div>
          <div className="form-field">
            <label htmlFor="worker-code">Code</label>
            <input
              id="worker-code"
              required
              value={values.code}
              disabled={!codeEditable}
              onChange={(e) => update("code", e.target.value)}
              placeholder="e.g. W-01"
            />
            {!codeEditable && <p className="field-hint">Code can&apos;t be changed after creation.</p>}
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="worker-trade">Trade / Skill</label>
            <input
              id="worker-trade"
              value={values.trade ?? ""}
              onChange={(e) => update("trade", e.target.value)}
              placeholder="e.g. Mason, Helper, Carpenter"
            />
          </div>
          <div className="form-field">
            <label htmlFor="worker-phone">Phone</label>
            <input
              id="worker-phone"
              value={values.phone ?? ""}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="e.g. 98xxxxxxxx"
            />
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="worker-rate">Default Day Rate (₹)</label>
            <input
              id="worker-rate"
              type="number"
              min="0"
              step="any"
              value={values.default_wage_rate}
              onChange={(e) => update("default_wage_rate", Number(e.target.value))}
              placeholder="e.g. 600"
            />
          </div>
          <div className="form-field">
            <label htmlFor="worker-status">Status</label>
            <select
              id="worker-status"
              value={values.status}
              onChange={(e) => update("status", e.target.value as WorkerStatus)}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status === "active" ? "Active" : "Inactive"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Notes</h2>
        <div className="form-field">
          <textarea
            id="worker-notes"
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
