import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import type {
  Contact, ContactField, SegCondition, SegField, SegOp, Segment, SegmentFolder, User,
} from "../types";

const BASE_FIELDS: { v: string; label: string }[] = [
  { v: "city", label: "City" },
  { v: "tag", label: "Tag" },
  { v: "name", label: "Name" },
  { v: "phone", label: "Phone" },
  { v: "email", label: "Email" },
  { v: "optedIn", label: "Opted in" },
];

function opsFor(field: string): { v: SegOp; label: string }[] {
  if (field === "tag") return [{ v: "has", label: "has" }];
  if (field === "optedIn") return [{ v: "equals", label: "is" }];
  return [
    { v: "contains", label: "contains" },
    { v: "equals", label: "equals" },
    { v: "not_equals", label: "not equals" },
    { v: "is_set", label: "is set" },
  ];
}

// Minimal CSV parser: handles quoted fields, commas and "" escapes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); if (row.some((x) => x.trim() !== "")) rows.push(row); }
  return rows;
}

const BASE_KEYS = ["phone", "name", "email", "city", "tags"];

function describeRules(seg: Segment, fields: ContactField[]): string {
  const conds = seg.rules?.conditions || [];
  if (!conds.length) return "All contacts";
  const label = (f: string) =>
    f.startsWith("attr:") ? (fields.find((x) => `attr:${x.key}` === f)?.label || f.slice(5)) : (BASE_FIELDS.find((b) => b.v === f)?.label || f);
  const parts = conds.map((c) => {
    const op = c.op === "has" ? "has" : c.op === "is_set" ? "is set" : c.op === "not_equals" ? "is not" : c.op === "equals" ? "is" : "contains";
    return `${label(c.field)} ${op}${c.op === "is_set" ? "" : ` ${c.value}`}`;
  });
  return parts.join(seg.rules.match === "any" ? " or " : " and ");
}

export default function Contacts({ me }: { me: User }) {
  const canEdit = me.role === "ADMIN" || me.role === "RM";
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [allCount, setAllCount] = useState(0);
  const [search, setSearch] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [folders, setFolders] = useState<SegmentFolder[]>([]);
  const [fields, setFields] = useState<ContactField[]>([]);
  const [activeSeg, setActiveSeg] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // drawers: null | "segment" | "fields" | "add"
  const [drawer, setDrawer] = useState<null | "segment" | "fields" | "add">(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // segment builder
  const [match, setMatch] = useState<"all" | "any">("all");
  const [conds, setConds] = useState<SegCondition[]>([{ field: "city", op: "equals", value: "" }]);
  const [segName, setSegName] = useState("");
  const [segFolder, setSegFolder] = useState("");
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  // add-contact form
  const [form, setForm] = useState({ phone: "", name: "", city: "", tags: "" });
  const [formAttrs, setFormAttrs] = useState<Record<string, string>>({});

  const [newField, setNewField] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  function loadContacts() {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (activeSeg) p.set("segmentId", activeSeg);
    api.get<{ contacts: Contact[]; total: number }>(`/contacts?${p.toString()}`)
      .then((r) => { setContacts(r.contacts); setTotal(r.total); setSelected(new Set()); }).catch(() => {});
  }
  function loadAllCount() {
    api.get<{ total: number }>("/contacts").then((r) => setAllCount(r.total)).catch(() => {});
  }
  function loadSegments() { api.get<{ segments: Segment[] }>("/segments").then((r) => setSegments(r.segments)).catch(() => {}); }
  function loadFolders() { api.get<{ folders: SegmentFolder[] }>("/segment-folders").then((r) => setFolders(r.folders)).catch(() => {}); }
  function loadFields() { api.get<{ fields: ContactField[] }>("/contact-fields").then((r) => setFields(r.fields)).catch(() => {}); }

  useEffect(() => { loadSegments(); loadFolders(); loadFields(); loadAllCount(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadContacts, [search, activeSeg]);

  const activeSegment = segments.find((s) => s.id === activeSeg) || null;
  const fieldOptions = [...BASE_FIELDS, ...fields.map((f) => ({ v: `attr:${f.key}`, label: f.label }))];

  // Group segments by folder for the sidebar
  const grouped = useMemo(() => {
    const byFolder = new Map<string, Segment[]>();
    const ungrouped: Segment[] = [];
    for (const s of segments) {
      if (s.folderId) { const arr = byFolder.get(s.folderId) || []; arr.push(s); byFolder.set(s.folderId, arr); }
      else ungrouped.push(s);
    }
    return { byFolder, ungrouped };
  }, [segments]);

  // ---------- segment builder ----------
  function openNewSegment() {
    setEditingId(null); setSegName(""); setSegFolder("");
    setMatch("all"); setConds([{ field: "city", op: "equals", value: "" }]);
    setPreviewCount(null); setDrawer("segment");
  }
  function openEditSegment(s: Segment) {
    setEditingId(s.id); setSegName(s.name); setSegFolder(s.folderId || "");
    setMatch(s.rules.match); setConds(s.rules.conditions.length ? s.rules.conditions : [{ field: "city", op: "equals", value: "" }]);
    setPreviewCount(s.count); setDrawer("segment");
  }
  function updateCond(i: number, patch: Partial<SegCondition>) {
    setConds((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function cleanRules() {
    return { match, conditions: conds.filter((c) => c.op === "is_set" || c.value !== "") };
  }
  async function preview() {
    const r = await api.post<{ count: number }>("/segments/preview", { rules: cleanRules() });
    setPreviewCount(r.count);
  }
  async function saveSegment() {
    if (!segName.trim()) return;
    const body = { name: segName.trim(), rules: cleanRules(), folderId: segFolder || null };
    if (editingId) await api.patch(`/segments/${editingId}`, body);
    else await api.post("/segments", body);
    setDrawer(null); loadSegments();
  }
  async function deleteSegment(id: string) {
    await api.del(`/segments/${id}`);
    if (activeSeg === id) setActiveSeg("");
    setDrawer(null); loadSegments();
  }

  // ---------- folders ----------
  async function delFolder(id: string) {
    await api.del(`/segment-folders/${id}`); loadFolders(); loadSegments();
  }
  function toggleFolder(id: string) {
    setCollapsed((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  // ---------- custom fields ----------
  async function addField() {
    if (!newField.trim()) return;
    await api.post("/contact-fields", { label: newField.trim(), type: "text" });
    setNewField(""); loadFields();
  }
  async function delField(id: string) { await api.del(`/contact-fields/${id}`); loadFields(); }

  // ---------- contacts ----------
  async function addContact() {
    const phone = form.phone.replace(/[^\d]/g, "");
    if (!phone) return;
    const attributes: Record<string, string> = {};
    for (const f of fields) if (formAttrs[f.key]?.trim()) attributes[f.key] = formAttrs[f.key].trim();
    await api.post("/contacts", {
      phone, name: form.name || undefined, city: form.city || undefined,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [], attributes,
    });
    setForm({ phone: "", name: "", city: "", tags: "" }); setFormAttrs({}); setDrawer(null);
    loadContacts(); loadAllCount();
  }
  async function importCsv(file: File) {
    setImportMsg("Importing…");
    const rows = parseCsv(await file.text());
    if (rows.length < 2) { setImportMsg("CSV needs a header row and data."); return; }
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const payload = rows.slice(1).map((cells) => {
      const rec: any = { attributes: {} as Record<string, string> };
      headers.forEach((h, i) => {
        const v = (cells[i] ?? "").trim(); if (!v) return;
        if (h === "phone" || h === "mobile" || h === "number") rec.phone = v;
        else if (BASE_KEYS.includes(h)) { if (h === "tags") rec.tags = v.split(/[;|]/).map((t) => t.trim()).filter(Boolean); else rec[h] = v; }
        else rec.attributes[h.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")] = v;
      });
      return rec;
    }).filter((r) => r.phone);
    if (!payload.length) { setImportMsg("No rows with a phone column found."); return; }
    const r = await api.post<{ imported: number }>("/contacts/import", { contacts: payload });
    setImportMsg(`Imported ${r.imported} contacts.`);
    loadContacts(); loadAllCount(); loadFields();
  }

  function exportCsv() {
    const cols = ["name", "phone", "city", "tags", ...fields.map((f) => f.key), "optedIn"];
    const head = ["Name", "Phone", "City", "Tags", ...fields.map((f) => f.label), "Opt-in"];
    const esc = (v: any) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [head.join(",")];
    for (const c of contacts) {
      const row = cols.map((k) => {
        if (k === "tags") return esc((c.tags || []).join(";"));
        if (k === "optedIn") return c.optedIn ? "yes" : "no";
        if (["name", "phone", "city"].includes(k)) return esc((c as any)[k]);
        return esc(c.attributes?.[k]);
      });
      lines.push(row.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `contacts-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- bulk ----------
  function toggleRow(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected((prev) => prev.size === contacts.length ? new Set() : new Set(contacts.map((c) => c.id)));
  }
  async function bulkDelete() {
    if (!selected.size || !confirm(`Delete ${selected.size} contacts?`)) return;
    for (const id of selected) await api.del(`/contacts/${id}`);
    setSelected(new Set()); loadContacts(); loadAllCount();
  }

  const headerName = activeSegment ? activeSegment.name : "All contacts";
  const headerDesc = activeSegment ? describeRules(activeSegment, fields) : "Everyone in your workspace";

  function SegRow({ s, nested }: { s: Segment; nested?: boolean }) {
    return (
      <div className={`side-item ${activeSeg === s.id ? "sel" : ""}`} style={{ paddingLeft: nested ? 30 : 12 }} onClick={() => setActiveSeg(s.id)}>
        <i className="ti ti-filter" />
        <span className="side-label">{s.name}</span>
        <span className="side-count">{s.count}</span>
      </div>
    );
  }

  return (
    <div className="contacts-layout">
      {/* Sidebar */}
      <aside className="side">
        <div className={`side-item ${activeSeg === "" ? "sel" : ""}`} onClick={() => setActiveSeg("")}>
          <i className="ti ti-users" />
          <span className="side-label" style={{ fontWeight: 500 }}>All contacts</span>
          <span className="side-count">{allCount}</span>
        </div>

        <div className="side-section">
          <span>Segments</span>
          {canEdit && (
            <span className="side-actions">
              <i className="ti ti-folder-plus" title="New folder" onClick={() => { const n = prompt("Folder name:"); if (n) api.post("/segment-folders", { name: n.trim() }).then(loadFolders); }} />
              <i className="ti ti-plus" title="New segment" onClick={openNewSegment} />
            </span>
          )}
        </div>

        <div className="side-scroll">
          {folders.map((f) => {
            const segs = grouped.byFolder.get(f.id) || [];
            const isCollapsed = collapsed.has(f.id);
            return (
              <div key={f.id}>
                <div className="side-folder" onClick={() => toggleFolder(f.id)}>
                  <i className={`ti ${isCollapsed ? "ti-chevron-right" : "ti-chevron-down"}`} />
                  <i className="ti ti-folder" />
                  <span className="side-label">{f.name}</span>
                  {canEdit && <i className="ti ti-x side-del" title="Delete folder" onClick={(e) => { e.stopPropagation(); delFolder(f.id); }} />}
                </div>
                {!isCollapsed && segs.map((s) => <SegRow key={s.id} s={s} nested />)}
              </div>
            );
          })}
          {grouped.ungrouped.map((s) => <SegRow key={s.id} s={s} />)}
          {segments.length === 0 && <div className="side-empty">No segments yet.</div>}
        </div>

        <div className="side-foot">
          {canEdit && <div className="side-item" onClick={() => setDrawer("fields")}><i className="ti ti-adjustments" /><span className="side-label">Custom fields</span></div>}
          {canEdit && <div className="side-item" onClick={() => csvRef.current?.click()}><i className="ti ti-upload" /><span className="side-label">Import CSV</span></div>}
          <input ref={csvRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
        </div>
      </aside>

      {/* Main */}
      <section className="main">
        <div className="main-head">
          <div>
            <div className="main-title">
              <span>{headerName}</span>
              <span className="pill-count">{total} contacts</span>
            </div>
            <div className="main-desc">{headerDesc}</div>
          </div>
          <div style={{ flex: 1 }} />
          {activeSegment && canEdit && <button className="btn small ghost" onClick={() => openEditSegment(activeSegment)}>Edit filter</button>}
        </div>

        <div className="main-tools">
          <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="tool-search" />
          {canEdit && <button className="btn small ghost" onClick={() => csvRef.current?.click()}>Import</button>}
          <button className="btn small ghost" onClick={exportCsv}>Export</button>
          {canEdit && <button className="btn small" onClick={() => { setForm({ phone: "", name: "", city: "", tags: "" }); setFormAttrs({}); setDrawer("add"); }}>+ Add</button>}
        </div>

        {importMsg && <div className="import-msg">{importMsg}</div>}

        {selected.size > 0 && (
          <div className="bulk-bar">
            <span>{selected.size} selected</span>
            <button className="btn small ghost" onClick={exportCsv}>Export</button>
            {canEdit && <button className="btn small danger" onClick={bulkDelete}>Delete</button>}
            <button className="btn small ghost" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}

        <div className="table-wrap">
          <table className="roster">
            <thead>
              <tr>
                <th style={{ width: 28 }}><input type="checkbox" checked={selected.size > 0 && selected.size === contacts.length} onChange={toggleAll} /></th>
                <th>Name</th><th>Phone</th><th>City</th><th>Tags</th>
                {fields.map((f) => <th key={f.id}>{f.label}</th>)}
                <th>Opt-in</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className={selected.has(c.id) ? "row-sel" : ""}>
                  <td><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleRow(c.id)} /></td>
                  <td>{c.name || "—"}</td>
                  <td>+{c.phone}</td>
                  <td>{c.city || "—"}</td>
                  <td>{c.tags.map((t) => <span key={t} className="mini assignee" style={{ marginRight: 4 }}>{t}</span>)}</td>
                  {fields.map((f) => <td key={f.id}>{c.attributes?.[f.key] ?? "—"}</td>)}
                  <td>{c.optedIn ? "yes" : "no"}</td>
                </tr>
              ))}
              {contacts.length === 0 && <tr><td colSpan={6 + fields.length} className="side-empty">No contacts match.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Right drawer */}
      {drawer && (
        <div className="drawer-scrim" onClick={() => setDrawer(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            {drawer === "segment" && (
              <>
                <div className="drawer-head"><span>{editingId ? "Edit segment" : "New segment"}</span><i className="ti ti-x" onClick={() => setDrawer(null)} /></div>
                <div className="drawer-body">
                  <label className="fl">Name</label>
                  <input value={segName} onChange={(e) => setSegName(e.target.value)} placeholder="e.g. Bengaluru leads" />
                  <label className="fl">Folder</label>
                  <select value={segFolder} onChange={(e) => setSegFolder(e.target.value)}>
                    <option value="">No folder</option>
                    {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <label className="fl">Match
                    <select value={match} onChange={(e) => setMatch(e.target.value as any)} style={{ margin: "0 6px" }}>
                      <option value="all">all</option><option value="any">any</option>
                    </select> of these conditions</label>
                  {conds.map((c, i) => (
                    <div className="cond-row" key={i}>
                      <select value={c.field} onChange={(e) => { const field = e.target.value; updateCond(i, { field: field as SegField, op: opsFor(field)[0].v, value: field === "optedIn" ? "true" : "" }); }}>
                        {fieldOptions.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
                      </select>
                      <select value={c.op} onChange={(e) => updateCond(i, { op: e.target.value as SegOp })}>
                        {opsFor(c.field).map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                      </select>
                      {c.op !== "is_set" && (c.field === "optedIn" ? (
                        <select value={String(c.value)} onChange={(e) => updateCond(i, { value: e.target.value })}><option value="true">yes</option><option value="false">no</option></select>
                      ) : (
                        <input value={typeof c.value === "string" ? c.value : ""} placeholder="value" onChange={(e) => updateCond(i, { value: e.target.value })} />
                      ))}
                      {conds.length > 1 && <button className="btn small ghost" onClick={() => setConds((p) => p.filter((_, idx) => idx !== i))}>×</button>}
                    </div>
                  ))}
                  <button className="btn small ghost" onClick={() => setConds((p) => [...p, { field: "tag", op: "has", value: "" }])}>+ condition</button>
                  <div className="drawer-preview">
                    <button className="btn small" onClick={preview}>Preview</button>
                    {previewCount !== null && <span className="saved">{previewCount} contacts match</span>}
                  </div>
                </div>
                <div className="drawer-foot">
                  {editingId && <button className="btn small danger" onClick={() => deleteSegment(editingId)}>Delete</button>}
                  <div style={{ flex: 1 }} />
                  <button className="btn small ghost" onClick={() => setDrawer(null)}>Cancel</button>
                  <button className="btn small" onClick={saveSegment} disabled={!segName.trim()}>{editingId ? "Save" : "Create"}</button>
                </div>
              </>
            )}

            {drawer === "fields" && (
              <>
                <div className="drawer-head"><span>Custom fields</span><i className="ti ti-x" onClick={() => setDrawer(null)} /></div>
                <div className="drawer-body">
                  <p className="main-desc" style={{ marginBottom: 12 }}>Your own fields appear on contacts, import and segments.</p>
                  {fields.map((f) => (
                    <div className="field-row" key={f.id}><span>{f.label}</span><i className="ti ti-trash side-del" onClick={() => delField(f.id)} /></div>
                  ))}
                  {fields.length === 0 && <div className="side-empty">No custom fields yet.</div>}
                  <div className="cond-row" style={{ marginTop: 12 }}>
                    <input placeholder="New field, e.g. Budget" value={newField} onChange={(e) => setNewField(e.target.value)} />
                    <button className="btn small" onClick={addField} disabled={!newField.trim()}>Add</button>
                  </div>
                </div>
              </>
            )}

            {drawer === "add" && (
              <>
                <div className="drawer-head"><span>Add contact</span><i className="ti ti-x" onClick={() => setDrawer(null)} /></div>
                <div className="drawer-body">
                  <label className="fl">Phone</label>
                  <input placeholder="91…" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  <label className="fl">Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <label className="fl">City</label>
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  <label className="fl">Tags (comma separated)</label>
                  <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
                  {fields.map((f) => (
                    <div key={f.id}><label className="fl">{f.label}</label>
                      <input value={formAttrs[f.key] || ""} onChange={(e) => setFormAttrs({ ...formAttrs, [f.key]: e.target.value })} /></div>
                  ))}
                </div>
                <div className="drawer-foot">
                  <div style={{ flex: 1 }} />
                  <button className="btn small ghost" onClick={() => setDrawer(null)}>Cancel</button>
                  <button className="btn small" onClick={addContact} disabled={!form.phone.trim()}>Save</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
