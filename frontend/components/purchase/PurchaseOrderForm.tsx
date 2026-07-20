"use client";

import { FormEvent, useEffect, useState } from "react";

import { listSites } from "@/lib/api/sites";
import { listVendors } from "@/lib/api/vendors";
import { POLineFormValues, PurchaseOrderFormValues } from "@/lib/types/purchase";
import { SiteListItem } from "@/lib/types/site";
import { VendorListItem } from "@/lib/types/vendor";

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const emptyLine = (): POLineFormValues => ({
  description: "",
  quantity: 1,
  unit: "",
  unit_price: 0,
});

interface Props {
  onSubmit: (values: PurchaseOrderFormValues) => Promise<void>;
  submitLabel: string;
}

export function PurchaseOrderForm({ onSubmit, submitLabel }: Props) {
  const [vendors, setVendors] = useState<VendorListItem[]>([]);
  const [sites, setSites] = useState<SiteListItem[]>([]);

  const [poNumber, setPoNumber] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<POLineFormValues[]>([emptyLine()]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listVendors({ status: "active", pageSize: 100 }).then((res) => setVendors(res.items));
    listSites({ pageSize: 100 }).then((res) => setSites(res.items));
  }, []);

  function updateLine(index: number, patch: Partial<POLineFormValues>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  const total = lines.reduce((sum, l) => sum + Number(l.quantity || 0) * Number(l.unit_price || 0), 0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!poNumber.trim() || !vendorId) {
      setError("PO number and vendor are required");
      return;
    }
    const cleanLines = lines.filter((l) => l.description.trim() && Number(l.quantity) > 0);
    if (cleanLines.length === 0) {
      setError("Add at least one line with a description and quantity");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        po_number: poNumber.trim(),
        vendor_id: vendorId,
        site_id: siteId || null,
        order_date: orderDate,
        expected_date: expectedDate || null,
        notes: notes || null,
        lines: cleanLines.map((l) => ({
          material_id: null,
          description: l.description.trim(),
          quantity: Number(l.quantity),
          unit: l.unit || null,
          unit_price: Number(l.unit_price),
        })),
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
        <h2 className="form-section-title">Order</h2>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="po-number">PO Number</label>
            <input
              id="po-number"
              required
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="e.g. PO-2026-001"
            />
          </div>
          <div className="form-field">
            <label htmlFor="po-vendor">Vendor</label>
            <select id="po-vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">Select vendor…</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="po-site">Site (optional)</label>
            <select id="po-site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">No specific site</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="po-order-date">Order Date</label>
            <input
              id="po-order-date"
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
            />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="po-expected">Expected Delivery (optional)</label>
          <input
            id="po-expected"
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
          />
        </div>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Line Items</h2>
        <table className="stock-table">
          <thead>
            <tr>
              <th style={{ width: "40%" }}>Description</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Unit Price</th>
              <th>Total</th>
              <th aria-label="remove" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td>
                  <input
                    aria-label={`Line ${i + 1} description`}
                    value={line.description}
                    onChange={(e) => updateLine(i, { description: e.target.value })}
                    placeholder="e.g. Cement OPC 53"
                  />
                </td>
                <td>
                  <input
                    aria-label={`Line ${i + 1} quantity`}
                    type="number"
                    min="0"
                    step="any"
                    value={line.quantity}
                    onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                    style={{ width: "5rem" }}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Line ${i + 1} unit`}
                    value={line.unit ?? ""}
                    onChange={(e) => updateLine(i, { unit: e.target.value })}
                    placeholder="bag"
                    style={{ width: "5rem" }}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Line ${i + 1} unit price`}
                    type="number"
                    min="0"
                    step="any"
                    value={line.unit_price}
                    onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })}
                    style={{ width: "7rem" }}
                  />
                </td>
                <td className="stock-on-hand">
                  {inr(Number(line.quantity || 0) * Number(line.unit_price || 0))}
                </td>
                <td>
                  <button
                    type="button"
                    className="link-danger"
                    onClick={() => removeLine(i)}
                    disabled={lines.length === 1}
                    aria-label={`Remove line ${i + 1}`}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} style={{ textAlign: "right", fontWeight: 600 }}>
                Order Total
              </td>
              <td className="stock-on-hand" style={{ fontWeight: 700 }}>
                {inr(total)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
        <button type="button" className="button-secondary" onClick={addLine}>
          + Add Line
        </button>
      </section>

      <section className="form-section">
        <h2 className="form-section-title">Notes</h2>
        <div className="form-field">
          <textarea id="po-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
