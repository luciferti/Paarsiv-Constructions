"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { addMaintenance, archiveEquipment, getEquipment, listMaintenance } from "@/lib/api/equipment";
import { Equipment, EQUIPMENT_STATUS_LABEL, MaintenanceLog } from "@/lib/types/equipment";

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

export default function EquipmentDetailPage({ params }: { params: { equipmentId: string } }) {
  const [eq, setEq] = useState<Equipment | null>(null);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([getEquipment(params.equipmentId), listMaintenance(params.equipmentId)])
      .then(([e, l]) => {
        setEq(e);
        setLogs(l);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, [params.equipmentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleArchive() {
    if (!confirm("Retire this equipment?")) return;
    await archiveEquipment(params.equipmentId);
    window.location.href = "/equipment";
  }

  async function handleAddLog(event: FormEvent) {
    event.preventDefault();
    if (!description.trim()) {
      setFormError("Enter a description");
      return;
    }
    setFormError(null);
    await addMaintenance(params.equipmentId, {
      service_date: serviceDate,
      description: description.trim(),
      cost: cost ? Number(cost) : 0,
    });
    setDescription("");
    setCost("");
    load();
  }

  if (error) return <p className="form-error">{error}</p>;
  if (!eq) return <p>Loading equipment...</p>;

  const maintTotal = logs.reduce((sum, l) => sum + l.cost, 0);

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <div>
          <div className="detail-code">{eq.code}</div>
          <h1>{eq.name}</h1>
        </div>
        <div className="site-actions">
          <span className={`status-badge status-${eq.status}`}>{EQUIPMENT_STATUS_LABEL[eq.status]}</span>
          <button type="button" onClick={handleArchive}>
            Retire
          </button>
        </div>
      </div>

      <dl className="site-overview">
        <dt>Category</dt>
        <dd>{eq.category ?? "—"}</dd>
        <dt>Ownership</dt>
        <dd style={{ textTransform: "capitalize" }}>{eq.ownership}</dd>
        <dt>Rate per unit</dt>
        <dd>{eq.rental_rate ? inr(eq.rental_rate) : "—"}</dd>
        <dt>Maintenance spend</dt>
        <dd>{inr(maintTotal)}</dd>
      </dl>

      <section className="form-section">
        <h2 className="form-section-title">Maintenance Log</h2>
        {logs.length > 0 ? (
          <table className="stock-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{l.service_date}</td>
                  <td>{l.description}</td>
                  <td className="stock-on-hand">{inr(l.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty-state">No maintenance logged yet.</p>
        )}

        <form onSubmit={handleAddLog} className="material-entry-form">
          {formError && <p className="form-error">{formError}</p>}
          <div className="form-grid form-grid-3">
            <div className="form-field">
              <label htmlFor="maint-date">Date</label>
              <input id="maint-date" type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="maint-desc">Description</label>
              <input id="maint-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Hydraulic oil change" />
            </div>
            <div className="form-field">
              <label htmlFor="maint-cost">Cost (₹)</label>
              <input id="maint-cost" type="number" min="0" step="any" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="button-primary">
            Add Maintenance
          </button>
        </form>
      </section>
    </div>
  );
}
