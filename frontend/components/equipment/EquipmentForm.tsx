"use client";

import { FormEvent, useState } from "react";

import { EquipmentFormValues, EquipmentOwnership, EquipmentStatus } from "@/lib/types/equipment";

function normalizeEmptyStrings(values: EquipmentFormValues): EquipmentFormValues {
  const normalized = { ...values } as Record<string, unknown>;
  for (const [key, value] of Object.entries(normalized)) {
    if (value === "") normalized[key] = null;
  }
  return normalized as unknown as EquipmentFormValues;
}

interface Props {
  initialValues?: Partial<EquipmentFormValues>;
  submitLabel: string;
  onSubmit: (values: EquipmentFormValues) => Promise<void>;
  codeEditable?: boolean;
}

export function EquipmentForm({ initialValues, submitLabel, onSubmit, codeEditable = true }: Props) {
  const [values, setValues] = useState<EquipmentFormValues>({
    name: initialValues?.name ?? "",
    code: initialValues?.code ?? "",
    category: initialValues?.category ?? "",
    ownership: initialValues?.ownership ?? "owned",
    status: initialValues?.status ?? "available",
    rental_rate: initialValues?.rental_rate ?? 0,
    notes: initialValues?.notes ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof EquipmentFormValues>(key: K, value: EquipmentFormValues[K]) {
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
            <label htmlFor="eq-name">Name</label>
            <input id="eq-name" required value={values.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. JCB 3DX Excavator" />
          </div>
          <div className="form-field">
            <label htmlFor="eq-code">Code</label>
            <input id="eq-code" required value={values.code} disabled={!codeEditable} onChange={(e) => update("code", e.target.value)} placeholder="e.g. EQ-01" />
          </div>
        </div>
        <div className="form-grid form-grid-3">
          <div className="form-field">
            <label htmlFor="eq-category">Category</label>
            <input id="eq-category" value={values.category ?? ""} onChange={(e) => update("category", e.target.value)} placeholder="e.g. Earthmoving" />
          </div>
          <div className="form-field">
            <label htmlFor="eq-ownership">Ownership</label>
            <select id="eq-ownership" value={values.ownership} onChange={(e) => update("ownership", e.target.value as EquipmentOwnership)}>
              <option value="owned">Owned</option>
              <option value="rented">Rented</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="eq-status">Status</label>
            <select id="eq-status" value={values.status} onChange={(e) => update("status", e.target.value as EquipmentStatus)}>
              <option value="available">Available</option>
              <option value="in_use">In use</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </select>
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="eq-rate">Rate per day/hour (₹) — used to prefill usage cost</label>
          <input id="eq-rate" type="number" min="0" step="any" value={values.rental_rate} onChange={(e) => update("rental_rate", Number(e.target.value))} />
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
