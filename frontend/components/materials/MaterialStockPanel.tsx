"use client";

import { FormEvent, useEffect, useState } from "react";

import { addSiteMaterialEntry, listMaterials } from "@/lib/api/materials";
import { listVendors } from "@/lib/api/vendors";
import { useSiteMaterialStock } from "@/lib/hooks/useMaterials";
import { MaterialEntryType, MaterialListItem } from "@/lib/types/material";
import { VendorListItem } from "@/lib/types/vendor";

const ENTRY_TYPE_LABEL: Record<MaterialEntryType, string> = {
  received: "Received",
  used: "Used",
  adjustment: "Adjustment",
};

export function MaterialStockPanel({ siteId }: { siteId: string }) {
  const { data: stock, loading, error, refetch } = useSiteMaterialStock(siteId);
  const [materials, setMaterials] = useState<MaterialListItem[]>([]);
  const [vendors, setVendors] = useState<VendorListItem[]>([]);

  const [materialId, setMaterialId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [entryType, setEntryType] = useState<MaterialEntryType>("received");
  const [quantity, setQuantity] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    listMaterials({ status: "active", pageSize: 100 }).then((res) => setMaterials(res.items));
    listVendors({ status: "active", pageSize: 100 }).then((res) => setVendors(res.items));
  }, []);

  async function handleAddEntry(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!materialId || !quantity || Number(quantity) <= 0) {
      setFormError("Choose a material and enter a quantity greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      await addSiteMaterialEntry(siteId, {
        material_id: materialId,
        vendor_id: vendorId || null,
        entry_type: entryType,
        quantity: Number(quantity),
        entry_date: entryDate,
      });
      setQuantity("");
      refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading materials...</p>;
  if (error) return <p className="form-error">{error}</p>;

  return (
    <div className="site-team-panel">
      {stock && stock.length > 0 ? (
        <table className="stock-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Unit</th>
              <th>Received</th>
              <th>Used</th>
              <th>Adjusted</th>
              <th>On Hand</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((item) => (
              <tr key={item.material_id}>
                <td>
                  {item.material_name} <span className="site-code">({item.material_code})</span>
                </td>
                <td>{item.unit}</td>
                <td>{item.quantity_received}</td>
                <td>{item.quantity_used}</td>
                <td>{item.quantity_adjusted}</td>
                <td className="stock-on-hand">{item.quantity_on_hand}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="empty-state">No material activity logged for this site yet.</p>
      )}

      <form onSubmit={handleAddEntry} className="material-entry-form">
        {formError && <p className="form-error">{formError}</p>}
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="entry-material">Material</label>
            <select id="entry-material" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
              <option value="">Select material…</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.unit})
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="entry-type">Type</label>
            <select
              id="entry-type"
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as MaterialEntryType)}
            >
              {(Object.keys(ENTRY_TYPE_LABEL) as MaterialEntryType[]).map((type) => (
                <option key={type} value={type}>
                  {ENTRY_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="entry-quantity">Quantity</label>
            <input
              id="entry-quantity"
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="entry-date">Date</label>
            <input
              id="entry-date"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>
        </div>
        {entryType === "received" && (
          <div className="form-field">
            <label htmlFor="entry-vendor">Vendor (optional)</label>
            <select id="entry-vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">Select vendor…</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "Logging…" : "Log Entry"}
        </button>
      </form>
    </div>
  );
}
