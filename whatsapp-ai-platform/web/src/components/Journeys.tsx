import { useEffect, useState } from "react";
import { api } from "../api";
import type { Journey, JourneyStep, User } from "../types";

export default function Journeys({ me }: { me: User }) {
  const canEdit = me.role === "ADMIN" || me.role === "RM";
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [steps, setSteps] = useState<JourneyStep[]>([{ type: "message", text: "" }]);

  function load() {
    api.get<{ journeys: Journey[] }>("/journeys").then((r) => setJourneys(r.journeys)).catch(() => {});
  }
  useEffect(load, []);

  function updateStep(i: number, patch: Partial<JourneyStep>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function create() {
    if (!name.trim() || !keyword.trim()) return;
    const clean = steps.filter((s) => (s.type === "message" ? (s.text || "").trim() : true));
    await api.post("/journeys", {
      name: name.trim(),
      triggerType: "keyword",
      triggerValue: keyword.trim(),
      steps: clean,
    });
    setName("");
    setKeyword("");
    setSteps([{ type: "message", text: "" }]);
    setShowForm(false);
    load();
  }

  async function toggle(j: Journey) {
    await api.patch(`/journeys/${j.id}/status`, { status: j.status === "ACTIVE" ? "DRAFT" : "ACTIVE" });
    load();
  }
  async function test(j: Journey) {
    const phone = prompt("Test phone (91…):", "919999888777");
    if (!phone) return;
    const r = await api.post<{ ran: number }>(`/journeys/${j.id}/test`, { phone });
    alert(`Ran ${r.ran} message step(s). Check that phone's conversation in the Inbox.`);
  }

  return (
    <div className="panel-view">
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Journeys</h2>
            <p className="card-sub" style={{ margin: "4px 0 0" }}>Automated flows: when a customer sends a keyword, run these steps.</p>
          </div>
          <div style={{ flex: 1 }} />
          {canEdit && <button className="btn small" onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "+ New journey"}</button>}
        </div>

        {showForm && (
          <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 16, marginBottom: 16 }}>
            <div className="cond-row">
              <input placeholder="Journey name" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
              <span className="card-sub" style={{ margin: 0 }}>Trigger when message contains</span>
              <input placeholder="keyword e.g. brochure" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            </div>

            <div className="journey-steps">
              {steps.map((s, i) => (
                <div className="journey-step" key={i}>
                  <span className="step-dot">{i + 1}</span>
                  <select value={s.type} onChange={(e) => updateStep(i, e.target.value === "wait" ? { type: "wait", hours: 24 } : { type: "message", text: "" })} style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 8 }}>
                    <option value="message">Send message</option>
                    <option value="wait">Wait</option>
                  </select>
                  {s.type === "message" ? (
                    <input placeholder="Message… use {{name}}" value={s.text || ""} onChange={(e) => updateStep(i, { text: e.target.value })} style={{ flex: 1 }} />
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input type="number" min={0} value={s.hours ?? 0} onChange={(e) => updateStep(i, { hours: Number(e.target.value) })} style={{ width: 70 }} />
                      <span className="card-sub" style={{ margin: 0 }}>hours</span>
                    </span>
                  )}
                  {steps.length > 1 && <button className="tpl-del" onClick={() => setSteps((p) => p.filter((_, idx) => idx !== i))}>×</button>}
                </div>
              ))}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn small ghost" onClick={() => setSteps((p) => [...p, { type: "message", text: "" }])}>+ message</button>
              <button className="btn small ghost" onClick={() => setSteps((p) => [...p, { type: "wait", hours: 24 }])}>+ wait</button>
              <div style={{ flex: 1 }} />
              <button className="btn small" onClick={create} disabled={!name.trim() || !keyword.trim()}>Save journey</button>
            </div>
          </div>
        )}

        <table className="roster">
          <thead><tr><th>Name</th><th>Trigger</th><th>Steps</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {journeys.map((j) => (
              <tr key={j.id}>
                <td>{j.name}</td>
                <td>keyword: <b>{j.triggerValue}</b></td>
                <td>{j.steps.length}</td>
                <td><span className={`mini ${j.status === "ACTIVE" ? "ai" : "assignee"}`}>{j.status.toLowerCase()}</span></td>
                <td style={{ textAlign: "right" }}>
                  {canEdit && <button className="btn small ghost" onClick={() => test(j)}>Test</button>}
                  {canEdit && <button className="btn small" style={{ marginLeft: 8 }} onClick={() => toggle(j)}>{j.status === "ACTIVE" ? "Pause" : "Activate"}</button>}
                </td>
              </tr>
            ))}
            {journeys.length === 0 && <tr><td colSpan={5} style={{ color: "var(--text-soft)", padding: 14 }}>No journeys yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
