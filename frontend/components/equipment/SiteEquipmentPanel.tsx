"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { addSiteEquipmentUsage, getSiteEquipmentCost, listEquipment } from "@/lib/api/equipment";
import { EquipmentListItem, SiteEquipmentCostItem } from "@/lib/types/equipment";

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export function SiteEquipmentPanel({ siteId }: { siteId: string }) {
  const [cost, setCost] = useState<SiteEquipmentCostItem[]>([]);
  const [equipment, setEquipment] = useState<EquipmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [equipmentId, setEquipmentId] = useState("");
  const [usageDate, setUsageDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState("");
  const [costOverride, setCostOverride] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getSiteEquipmentCost(siteId)
      .then((data) => {
        setCost(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [siteId]);

  useEffect(() => {
    load();
    listEquipment({ pageSize: 100 }).then((res) => setEquipment(res.items));
  }, [load]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!equipmentId || !quantity || Number(quantity) <= 0) {
      setFormError("Choose equipment and enter quantity (hours/days)");
      return;
    }
    setSubmitting(true);
    try {
      await addSiteEquipmentUsage(siteId, {
        equipment_id: equipmentId,
        usage_date: usageDate,
        quantity: Number(quantity),
        cost: costOverride ? Number(costOverride) : null,
      });
      setQuantity("");
      setCostOverride("");
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading equipment…</p>;
  if (error) return <p className="form-error">{error}</p>;

  const totalCost = cost.reduce((sum, c) => sum + c.total_cost, 0);

  return (
    <div className="site-team-panel">
      {cost.length > 0 ? (
        <table className="stock-table">
          <thead>
            <tr>
              <th>Equipment</th>
              <th>Total Qty (hrs/days)</th>
              <th>Total Cost</th>
            </tr>
          </thead>
          <tbody>
            {cost.map((c) => (
              <tr key={c.equipment_id}>
                <td>
                  {c.equipment_name} <span className="site-code">({c.equipment_code})</span>
                </td>
                <td>{c.total_quantity}</td>
                <td className="stock-on-hand">{inr(c.total_cost)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} style={{ textAlign: "right", fontWeight: 600 }}>
                Total equipment cost
              </td>
              <td className="stock-on-hand" style={{ fontWeight: 700 }}>
                {inr(totalCost)}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="empty-state">No equipment usage logged for this site yet.</p>
      )}

      <form onSubmit={handleAdd} className="material-entry-form">
        {formError && <p className="form-error">{formError}</p>}
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="eq-usage-equipment">Equipment</label>
            <select id="eq-usage-equipment" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
              <option value="">Select equipment…</option>
              {equipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} {e.rental_rate ? `— ₹${Number(e.rental_rate).toLocaleString("en-IN")}/unit` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="eq-usage-date">Date</label>
            <input id="eq-usage-date" type="date" value={usageDate} onChange={(e) => setUsageDate(e.target.value)} />
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="eq-usage-qty">Quantity (hours / days)</label>
            <input id="eq-usage-qty" type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="eq-usage-cost">Cost override (optional)</label>
            <input id="eq-usage-cost" type="number" min="0" step="any" value={costOverride} onChange={(e) => setCostOverride(e.target.value)} placeholder="Blank = rate × quantity" />
          </div>
        </div>
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "Logging…" : "Log Usage"}
        </button>
      </form>
    </div>
  );
}
