import { useEffect, useState } from "react";
import { api } from "../api";
import type { Campaign, Segment, Template, User } from "../types";

const STATUS_CLASS: Record<string, string> = {
  DRAFT: "assignee",
  SENDING: "human",
  SENT: "ai",
  FAILED: "human",
};

export default function Campaigns({ me }: { me: User }) {
  const canEdit = me.role === "ADMIN" || me.role === "RM";
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", templateId: "", segmentId: "" });

  function load() {
    api.get<{ campaigns: Campaign[] }>("/campaigns").then((r) => setCampaigns(r.campaigns)).catch(() => {});
  }
  useEffect(() => {
    load();
    api.get<{ templates: Template[] }>("/templates").then((r) => setTemplates(r.templates)).catch(() => {});
    api.get<{ segments: Segment[] }>("/segments").then((r) => setSegments(r.segments)).catch(() => {});
  }, []);

  const selectedSeg = segments.find((s) => s.id === form.segmentId);

  async function create() {
    if (!form.name.trim() || !form.templateId) return;
    await api.post("/campaigns", {
      name: form.name.trim(),
      templateId: form.templateId,
      segmentId: form.segmentId || null,
    });
    setForm({ name: "", templateId: "", segmentId: "" });
    setShowForm(false);
    load();
  }

  async function send(id: string) {
    await api.post(`/campaigns/${id}/send`);
    // poll a couple times for stats to settle
    setTimeout(load, 800);
    setTimeout(load, 2500);
  }

  return (
    <div className="panel-view">
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Campaigns</h2>
            <p className="card-sub" style={{ margin: "4px 0 0" }}>Send a template to a segment as a broadcast.</p>
          </div>
          <div style={{ flex: 1 }} />
          {canEdit && <button className="btn small" onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "+ New campaign"}</button>}
        </div>

        {showForm && (
          <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 16, marginBottom: 16 }}>
            <div className="cond-row">
              <input placeholder="Campaign name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ flex: 1 }} />
            </div>
            <div className="cond-row">
              <select value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })} style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8 }}>
                <option value="">— pick template —</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={form.segmentId} onChange={(e) => setForm({ ...form, segmentId: e.target.value })} style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 8 }}>
                <option value="">All contacts</option>
                {segments.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.count})</option>)}
              </select>
            </div>
            <div className="row" style={{ alignItems: "center" }}>
              <span className="card-sub" style={{ margin: 0 }}>
                Audience: <b>{form.segmentId ? selectedSeg?.count ?? 0 : "all opted-in"}</b> contacts
              </span>
              <div style={{ flex: 1 }} />
              <button className="btn small" onClick={create} disabled={!form.name.trim() || !form.templateId}>Create draft</button>
            </div>
          </div>
        )}

        <table className="roster">
          <thead>
            <tr><th>Name</th><th>Template</th><th>Segment</th><th>Status</th><th>Sent / Read</th><th></th></tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.templateName || "—"}</td>
                <td>{c.segmentName}</td>
                <td><span className={`mini ${STATUS_CLASS[c.status] || "assignee"}`}>{c.status.toLowerCase()}</span></td>
                <td>
                  {c.status === "SENT" || c.status === "SENDING"
                    ? `${c.sentCount}/${c.totalCount} · ${c.readCount} read`
                    : `${c.totalCount} recipients`}
                </td>
                <td style={{ textAlign: "right" }}>
                  {canEdit && c.status === "DRAFT" && <button className="btn small" onClick={() => send(c.id)}>Send</button>}
                  {canEdit && <button className="tpl-del" style={{ marginLeft: 8 }} onClick={() => api.del(`/campaigns/${c.id}`).then(load)}>delete</button>}
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && <tr><td colSpan={6} style={{ color: "var(--text-soft)", padding: 14 }}>No campaigns yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
