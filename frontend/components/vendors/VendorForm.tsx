"use client";

import { FormEvent, useState } from "react";

import { VendorFormValues, VendorStatus } from "@/lib/types/vendor";

const STATUS_OPTIONS: VendorStatus[] = ["active", "inactive", "blacklisted"];

const STATUS_LABEL: Record<VendorStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  blacklisted: "Blacklisted",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmptyStrings(values: VendorFormValues): VendorFormValues {
  const normalized = { ...values } as Record<string, unknown>;
  for (const [key, value] of Object.entries(normalized)) {
    if (value === "") normalized[key] = null;
  }
  return normalized as unknown as VendorFormValues;
}

function validate(values: VendorFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.email && !EMAIL_RE.test(values.email)) {
    errors.email = "Enter a valid email address, or leave blank";
  }
  return errors;
}

interface VendorFormProps {
  initialValues?: Partial<VendorFormValues>;
  submitLabel: string;
  onSubmit: (values: VendorFormValues) => Promise<void>;
  codeEditable?: boolean;
}

export function VendorForm({
  initialValues,
  submitLabel,
  onSubmit,
  codeEditable = true,
}: VendorFormProps) {
  const [values, setValues] = useState<VendorFormValues>({
    name: initialValues?.name ?? "",
    code: initialValues?.code ?? "",
    category: initialValues?.category ?? "",
    contact_name: initialValues?.contact_name ?? "",
    phone: initialValues?.phone ?? "",
    email: initialValues?.email ?? "",
    address_line: initialValues?.address_line ?? "",
    city: initialValues?.city ?? "",
    state: initialValues?.state ?? "",
    country: initialValues?.country ?? "",
    postal_code: initialValues?.postal_code ?? "",
    tax_id: initialValues?.tax_id ?? "",
    status: initialValues?.status ?? "active",
    notes: initialValues?.notes ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof VendorFormValues>(key: K, value: VendorFormValues[K]) {
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

  return (
    <form onSubmit={handleSubmit} className="site-form" noValidate>
      {error && <p className="form-banner-error">{error}</p>}

      <section className="form-section">
        <h2 className="form-section-title">Basics</h2>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="vendor-name">Name</label>
            <input
              id="vendor-name"
              required
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Ace Steel Supply"
            />
          </div>
          <div className="form-field">
            <label htmlFor="vendor-code">Code</label>
            <input
              id="vendor-code"
              required
              value={values.code}
              disabled={!codeEditable}
              onChange={(e) => update("code", e.target.value)}
              placeholder="e.g. ACE-01"
            />
            {!codeEditable && <p className="field-hint">Code can&apos;t be changed after creation.</p>}
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="vendor-category">Category</label>
            <input
              id="vendor-category"
              value={values.category ?? ""}
              onChange={(e) => update("category", e.target.value)}
              placeholder="e.g. Material Supplier"
            />
          </div>
          <div className="form-field">
            <label htmlFor="vendor-status">Status</label>
            <select
              id="vendor-status"
              value={values.status}
              onChange={(e) => update("status", e.target.value as VendorStatus)}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Contact</h2>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="vendor-contact-name">Contact Name</label>
            <input
              id="vendor-contact-name"
              value={values.contact_name ?? ""}
              onChange={(e) => update("contact_name", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="vendor-phone">Phone</label>
            <input
              id="vendor-phone"
              value={values.phone ?? ""}
              onChange={(e) => update("phone", e.target.value)}
            />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="vendor-email">Email</label>
          <input
            id="vendor-email"
            type="email"
            value={values.email ?? ""}
            onChange={(e) => update("email", e.target.value)}
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Location &amp; Tax</h2>
        <div className="form-field">
          <label htmlFor="vendor-address">Address</label>
          <input
            id="vendor-address"
            value={values.address_line ?? ""}
            onChange={(e) => update("address_line", e.target.value)}
          />
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="vendor-city">City</label>
            <input
              id="vendor-city"
              value={values.city ?? ""}
              onChange={(e) => update("city", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="vendor-state">State</label>
            <input
              id="vendor-state"
              value={values.state ?? ""}
              onChange={(e) => update("state", e.target.value)}
            />
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="vendor-country">Country</label>
            <input
              id="vendor-country"
              value={values.country ?? ""}
              onChange={(e) => update("country", e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="vendor-postal">Postal Code</label>
            <input
              id="vendor-postal"
              value={values.postal_code ?? ""}
              onChange={(e) => update("postal_code", e.target.value)}
            />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="vendor-tax-id">Tax ID / GST Number</label>
          <input
            id="vendor-tax-id"
            value={values.tax_id ?? ""}
            onChange={(e) => update("tax_id", e.target.value)}
          />
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Notes</h2>
        <div className="form-field">
          <textarea
            id="vendor-notes"
            rows={3}
            value={values.notes ?? ""}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Optional internal notes about this vendor"
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
