"use client";

import { FormEvent, useState } from "react";

import { SiteFormValues, SiteStatus } from "@/lib/types/site";

const STATUS_OPTIONS: SiteStatus[] = ["planning", "active", "on_hold", "completed", "archived"];

const STATUS_LABEL: Record<SiteStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  archived: "Archived",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Empty text/date inputs hold "" in React state, but the optional
// backend fields expect either a real value or null — "" fails
// Pydantic's date/UUID validators.
function normalizeEmptyStrings(values: SiteFormValues): SiteFormValues {
  const normalized = { ...values } as Record<string, unknown>;
  for (const [key, value] of Object.entries(normalized)) {
    if (value === "") normalized[key] = null;
  }
  return normalized as unknown as SiteFormValues;
}

function validate(values: SiteFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.project_id && !UUID_RE.test(values.project_id)) {
    errors.project_id = "Must be a valid Project ID (UUID), or left blank";
  }
  if (values.site_manager_id && !UUID_RE.test(values.site_manager_id)) {
    errors.site_manager_id = "Must be a valid Employee ID (UUID), or left blank";
  }
  return errors;
}

interface SiteFormProps {
  initialValues?: Partial<SiteFormValues>;
  submitLabel: string;
  onSubmit: (values: SiteFormValues) => Promise<void>;
  /** Code is immutable after creation — the API has no way to change it. */
  codeEditable?: boolean;
}

export function SiteForm({
  initialValues,
  submitLabel,
  onSubmit,
  codeEditable = true,
}: SiteFormProps) {
  const [values, setValues] = useState<SiteFormValues>({
    name: initialValues?.name ?? "",
    code: initialValues?.code ?? "",
    address_line: initialValues?.address_line ?? "",
    city: initialValues?.city ?? "",
    state: initialValues?.state ?? "",
    country: initialValues?.country ?? "",
    postal_code: initialValues?.postal_code ?? "",
    latitude: initialValues?.latitude ?? null,
    longitude: initialValues?.longitude ?? null,
    site_type: initialValues?.site_type ?? "",
    status: initialValues?.status ?? "planning",
    start_date: initialValues?.start_date ?? "",
    expected_end_date: initialValues?.expected_end_date ?? "",
    project_id: initialValues?.project_id ?? "",
    site_manager_id: initialValues?.site_manager_id ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof SiteFormValues>(key: K, value: SiteFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit(normalizeEmptyStrings(values));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const hasAdvancedValues = Boolean(initialValues?.project_id || initialValues?.site_manager_id);

  return (
    <form onSubmit={handleSubmit} className="site-form" noValidate>
      {error && <p className="form-banner-error">{error}</p>}

      <section className="form-section">
        <h2 className="form-section-title">Basics</h2>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="site-name">Name</label>
            <input
              id="site-name"
              required
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Riverside Tower"
            />
          </div>
          <div className="form-field">
            <label htmlFor="site-code">Code</label>
            <input
              id="site-code"
              required
              value={values.code}
              disabled={!codeEditable}
              onChange={(e) => update("code", e.target.value)}
              placeholder="e.g. RVT-01"
            />
            {!codeEditable && <p className="field-hint">Code can&apos;t be changed after creation.</p>}
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Location</h2>
        <div className="form-field">
          <label htmlFor="site-address">Address</label>
          <input
            id="site-address"
            value={values.address_line ?? ""}
            onChange={(e) => update("address_line", e.target.value)}
          />
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="site-city">City</label>
            <input id="site-city" value={values.city ?? ""} onChange={(e) => update("city", e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="site-state">State</label>
            <input id="site-state" value={values.state ?? ""} onChange={(e) => update("state", e.target.value)} />
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="site-country">Country</label>
            <input
              id="site-country"
              value={values.country ?? ""}
              onChange={(e) => update("country", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="site-postal">Postal Code</label>
            <input
              id="site-postal"
              value={values.postal_code ?? ""}
              onChange={(e) => update("postal_code", e.target.value)}
            />
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="site-lat">Latitude</label>
            <input
              id="site-lat"
              type="number"
              step="any"
              value={values.latitude ?? ""}
              onChange={(e) => update("latitude", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="site-lng">Longitude</label>
            <input
              id="site-lng"
              type="number"
              step="any"
              value={values.longitude ?? ""}
              onChange={(e) => update("longitude", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Schedule &amp; Status</h2>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="site-start">Start Date</label>
            <input
              id="site-start"
              type="date"
              value={values.start_date ?? ""}
              onChange={(e) => update("start_date", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="site-end">Expected End Date</label>
            <input
              id="site-end"
              type="date"
              value={values.expected_end_date ?? ""}
              onChange={(e) => update("expected_end_date", e.target.value)}
            />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="site-status">Status</label>
          <select
            id="site-status"
            value={values.status}
            onChange={(e) => update("status", e.target.value as SiteStatus)}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>
      </section>

      <details className="form-advanced" open={hasAdvancedValues}>
        <summary>Advanced (link to Project / Site Manager)</summary>
        <p className="field-hint">
          These link to existing HRMS records by ID. A proper search picker replaces this once
          the Project and Employee modules are wired in — for now, paste the record&apos;s ID.
        </p>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="site-project">Project ID</label>
            <input
              id="site-project"
              value={values.project_id ?? ""}
              onChange={(e) => update("project_id", e.target.value || null)}
              placeholder="UUID of an existing Project"
              aria-invalid={Boolean(fieldErrors.project_id)}
            />
            {fieldErrors.project_id && <p className="field-error">{fieldErrors.project_id}</p>}
          </div>
          <div className="form-field">
            <label htmlFor="site-manager">Site Manager (Employee ID)</label>
            <input
              id="site-manager"
              value={values.site_manager_id ?? ""}
              onChange={(e) => update("site_manager_id", e.target.value || null)}
              placeholder="UUID of an existing Employee"
              aria-invalid={Boolean(fieldErrors.site_manager_id)}
            />
            {fieldErrors.site_manager_id && (
              <p className="field-error">{fieldErrors.site_manager_id}</p>
            )}
          </div>
        </div>
      </details>

      <div className="form-actions">
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
