"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Folder as FolderIcon, FolderPlus, Plus, Filter, ChevronDown, ChevronRight,
  X, Search, Upload, Download, Trash2, SlidersHorizontal, Pencil, GitMerge, Loader2,
} from "lucide-react";
import clsx from "clsx";
import { api, getSession } from "@/lib/api";
import type { Contact, ContactField, Folder, SegCondition, SegOp, Segment } from "@/lib/types";

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
    f.startsWith("attr:")
      ? fields.find((x) => `attr:${x.key}` === f)?.label || f.slice(5)
      : BASE_FIELDS.find((b) => b.v === f)?.label || f;
  const parts = conds.map((c) => {
    const op = c.op === "has" ? "has" : c.op === "is_set" ? "is set" : c.op === "not_equals" ? "is not" : c.op === "equals" ? "is" : "contains";
    return `${label(c.field)} ${op}${c.op === "is_set" ? "" : ` ${c.value}`}`;
  });
  return parts.join(seg.rules.match === "any" ? " or " : " and ");
}

const inputCls = "w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const btnPri = "h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-8 px-3 rounded-lg border text-xs font-medium hover:bg-muted";

type DrawerKind = null | "segment" | "fields" | "add" | "dupes";

interface DupGroup {
  reason: string;
  field?: string;
  key: string;
  suggestedPrimaryId: string;
  contacts: Contact[];
}

export default function ContactsPage() {
  const router = useRouter();
  const session = typeof window !== "undefined" ? getSession() : null;
  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "RM";

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [allCount, setAllCount] = useState(0);
  const [search, setSearch] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [fields, setFields] = useState<ContactField[]>([]);
  const [activeSeg, setActiveSeg] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"contacts" | "segments">("contacts"); // main-area mode
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  // segment builder state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [segName, setSegName] = useState("");
  const [segFolder, setSegFolder] = useState("");
  const [match, setMatch] = useState<"all" | "any">("all");
  const [conds, setConds] = useState<SegCondition[]>([{ field: "city", op: "equals", value: "" }]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  // add-contact + fields state
  const [form, setForm] = useState({ phone: "", name: "", city: "", tags: "" });
  const [formAttrs, setFormAttrs] = useState<Record<string, string>>({});
  const [newField, setNewField] = useState("");

  // duplicate merge
  const [dupGroups, setDupGroups] = useState<DupGroup[] | null>(null);
  const [dupLoading, setDupLoading] = useState(false);
  const [primaries, setPrimaries] = useState<Record<number, string>>({});
  const [merging, setMerging] = useState<number | null>(null);

  const loadContacts = useCallback(() => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (activeSeg) p.set("segmentId", activeSeg);
    api.get<{ contacts: Contact[]; total: number }>(`/contacts?${p.toString()}`)
      .then((r) => { setContacts(r.contacts); setTotal(r.total); setSelected(new Set()); })
      .catch(() => {});
  }, [search, activeSeg]);
  const loadAll = useCallback(() => {
    api.get<{ total: number }>("/contacts").then((r) => setAllCount(r.total)).catch(() => {});
  }, []);
  const loadSegments = useCallback(() => {
    api.get<{ segments: Segment[] }>("/segments").then((r) => setSegments(r.segments)).catch(() => {});
  }, []);
  const loadFolders = useCallback(() => {
    api.get<{ folders: Folder[] }>("/segment-folders").then((r) => setFolders(r.folders)).catch(() => {});
  }, []);
  const loadFields = useCallback(() => {
    api.get<{ fields: ContactField[] }>("/contact-fields").then((r) => setFields(r.fields)).catch(() => {});
  }, []);

  useEffect(() => { loadSegments(); loadFolders(); loadFields(); loadAll(); }, [loadSegments, loadFolders, loadFields, loadAll]);
  useEffect(loadContacts, [loadContacts]);

  const activeSegment = segments.find((s) => s.id === activeSeg) || null;
  const fieldOptions = [...BASE_FIELDS, ...fields.map((f) => ({ v: `attr:${f.key}`, label: f.label }))];

  const grouped = useMemo(() => {
    const byFolder = new Map<string, Segment[]>();
    const ungrouped: Segment[] = [];
    for (const s of segments) {
      if (s.folderId) { const a = byFolder.get(s.folderId) || []; a.push(s); byFolder.set(s.folderId, a); }
      else ungrouped.push(s);
    }
    return { byFolder, ungrouped };
  }, [segments]);

  // ---------- segment builder ----------
  function openNewSegment() {
    setEditingId(null); setSegName(""); setSegFolder(activeSegment?.folderId || "");
    setMatch("all"); setConds([{ field: "city", op: "equals", value: "" }]);
    setPreviewCount(null); setDrawer("segment");
  }
  function openEditSegment(s: Segment) {
    setEditingId(s.id); setSegName(s.name); setSegFolder(s.folderId || "");
    setMatch(s.rules.match);
    setConds(s.rules.conditions.length ? s.rules.conditions : [{ field: "city", op: "equals", value: "" }]);
    setPreviewCount(s.count); setDrawer("segment");
  }
  function updateCond(i: number, patch: Partial<SegCondition>) {
    setConds((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  const cleanRules = () => ({ match, conditions: conds.filter((c) => c.op === "is_set" || c.value !== "") });
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

  // ---------- duplicate merge ----------
  async function openDupes() {
    setDrawer("dupes");
    setDupLoading(true);
    try {
      const r = await api.get<{ groups: DupGroup[] }>("/contacts/duplicates");
      setDupGroups(r.groups);
      const pre: Record<number, string> = {};
      r.groups.forEach((g, i) => { pre[i] = g.suggestedPrimaryId; });
      setPrimaries(pre);
    } finally {
      setDupLoading(false);
    }
  }
  async function mergeGroup(i: number) {
    if (!dupGroups) return;
    const g = dupGroups[i];
    const primaryId = primaries[i] || g.suggestedPrimaryId;
    const duplicateIds = g.contacts.filter((c) => c.id !== primaryId).map((c) => c.id);
    setMerging(i);
    try {
      await api.post("/contacts/merge", { primaryId, duplicateIds });
      const r = await api.get<{ groups: DupGroup[] }>("/contacts/duplicates");
      setDupGroups(r.groups);
      const pre: Record<number, string> = {};
      r.groups.forEach((g2, idx) => { pre[idx] = g2.suggestedPrimaryId; });
      setPrimaries(pre);
      loadContacts(); loadAll();
    } finally {
      setMerging(null);
    }
  }

  // ---------- csv ----------
  async function importCsv(file: File) {
    setImportMsg("Importing…");
    const rows = parseCsv(await file.text());
    if (rows.length < 2) { setImportMsg("CSV needs a header row and data."); return; }
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const payload = rows.slice(1).map((cells) => {
      const rec: Record<string, unknown> & { attributes: Record<string, string> } = { attributes: {} };
      headers.forEach((h, i) => {
        const v = (cells[i] ?? "").trim(); if (!v) return;
        if (h === "phone" || h === "mobile" || h === "number") rec.phone = v;
        else if (BASE_KEYS.includes(h)) {
          if (h === "tags") rec.tags = v.split(/[;|]/).map((t) => t.trim()).filter(Boolean);
          else rec[h] = v;
        } else rec.attributes[h.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")] = v;
      });
      return rec;
    }).filter((r) => r.phone);
    if (!payload.length) { setImportMsg("No rows with a phone column found."); return; }
    const r = await api.post<{ imported: number }>("/contacts/import", { contacts: payload });
    setImportMsg(`Imported ${r.imported} contacts.`);
    loadContacts(); loadAll(); loadFields();
  }

  function exportCsv() {
    const cols = ["name", "phone", "city", "tags", ...fields.map((f) => f.key), "optedIn"];
    const head = ["Name", "Phone", "City", "Tags", ...fields.map((f) => f.label), "Opt-in"];
    const esc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const pool = selected.size ? contacts.filter((c) => selected.has(c.id)) : contacts;
    const lines = [head.join(",")];
    for (const c of pool) {
      lines.push(cols.map((k) => {
        if (k === "tags") return esc((c.tags || []).join(";"));
        if (k === "optedIn") return c.optedIn ? "yes" : "no";
        if (["name", "phone", "city"].includes(k)) return esc((c as unknown as Record<string, unknown>)[k]);
        return esc(c.attributes?.[k]);
      }).join(","));
    }
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `contacts-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- contacts ----------
  async function addContact() {
    const phone = form.phone.replace(/[^\d]/g, "");
    if (!phone) return;
    const attributes: Record<string, string> = {};
    for (const f of fields) if (formAttrs[f.key]?.trim()) attributes[f.key] = formAttrs[f.key].trim();
    await api.post("/contacts", {
      phone,
      name: form.name || undefined,
      city: form.city || undefined,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      attributes,
    });
    setForm({ phone: "", name: "", city: "", tags: "" }); setFormAttrs({}); setDrawer(null);
    loadContacts(); loadAll();
  }
  async function bulkDelete() {
    if (!selected.size || !confirm(`Delete ${selected.size} contacts?`)) return;
    for (const id of Array.from(selected)) await api.del(`/contacts/${id}`);
    setSelected(new Set()); loadContacts(); loadAll();
  }

  const headerName = activeSegment ? activeSegment.name : "All contacts";
  const headerDesc = activeSegment ? describeRules(activeSegment, fields) : "Everyone in your workspace";

  function SegRow({ s, nested }: { s: Segment; nested?: boolean }) {
    const active = view === "contacts" && activeSeg === s.id;
    return (
      <button
        onClick={() => { setActiveSeg(s.id); setView("contacts"); }}
        className={clsx(
          "w-full flex items-center gap-2 h-8 rounded-lg text-[13px] pr-2",
          nested ? "pl-8" : "pl-3",
          active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-muted"
        )}
      >
        <Filter className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 truncate text-left">{s.name}</span>
        <span className="text-[11px]">{s.count}</span>
      </button>
    );
  }

  return (
    <div className="flex-1 flex min-h-0">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r bg-card flex flex-col p-2.5 min-h-0">
        <button
          onClick={() => { setActiveSeg(""); setView("contacts"); }}
          className={clsx(
            "flex items-center gap-2 h-9 px-3 rounded-lg text-[13px]",
            view === "contacts" && activeSeg === "" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-muted"
          )}
        >
          <Users className="w-4 h-4" />
          <span className="flex-1 text-left">All contacts</span>
          <span className="text-[11px]">{allCount}</span>
        </button>

        <div className={clsx(
          "flex items-center justify-between pl-3 pr-2 h-8 mt-3 mb-0.5 rounded-lg cursor-pointer group/seghead",
          view === "segments" ? "bg-accent" : "hover:bg-muted"
        )}>
          <button
            onClick={() => setView("segments")}
            className={clsx(
              "flex-1 text-left text-[11px] font-semibold uppercase tracking-wide",
              view === "segments" ? "text-accent-foreground" : "text-muted-foreground group-hover/seghead:text-foreground"
            )}
            title="View all segments"
          >
            Segments <span className="normal-case font-normal">({segments.length})</span>
          </button>
          {canEdit && (
            <span className="flex gap-2 text-muted-foreground">
              <FolderPlus
                className="w-4 h-4 cursor-pointer hover:text-primary"
                onClick={(e) => { e.stopPropagation(); const n = prompt("Folder name:"); if (n?.trim()) api.post("/segment-folders", { name: n.trim() }).then(loadFolders); }}
              />
              <Plus className="w-4 h-4 cursor-pointer hover:text-primary" onClick={(e) => { e.stopPropagation(); openNewSegment(); }} />
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-0.5">
          {folders.map((f) => {
            const segs = grouped.byFolder.get(f.id) || [];
            const isC = collapsed.has(f.id);
            return (
              <div key={f.id}>
                <button
                  onClick={() => setCollapsed((p) => { const n = new Set(p); if (n.has(f.id)) { n.delete(f.id); } else { n.add(f.id); } return n; })}
                  className="w-full flex items-center gap-1.5 h-8 px-2 rounded-lg text-[13px] text-muted-foreground hover:bg-muted group"
                >
                  {isC ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <FolderIcon className="w-3.5 h-3.5" />
                  <span className="flex-1 truncate text-left text-foreground">{f.name}</span>
                  {canEdit && (
                    <X
                      className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); api.del(`/segment-folders/${f.id}`).then(() => { loadFolders(); loadSegments(); }); }}
                    />
                  )}
                </button>
                {!isC && segs.map((s) => <SegRow key={s.id} s={s} nested />)}
              </div>
            );
          })}
          {grouped.ungrouped.map((s) => <SegRow key={s.id} s={s} />)}
        </div>

        {canEdit && (
          <div className="border-t pt-2 space-y-0.5">
            <button onClick={() => setDrawer("fields")} className="w-full flex items-center gap-2 h-8 px-3 rounded-lg text-[13px] text-muted-foreground hover:bg-muted">
              <SlidersHorizontal className="w-4 h-4" /> Custom fields
            </button>
            <button onClick={() => csvRef.current?.click()} className="w-full flex items-center gap-2 h-8 px-3 rounded-lg text-[13px] text-muted-foreground hover:bg-muted">
              <Upload className="w-4 h-4" /> Import CSV
            </button>
            <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
          </div>
        )}
      </aside>

      {/* Main */}
      <section className="flex-1 min-w-0 flex flex-col bg-background">
        {view === "segments" && (
          <>
            <div className="px-6 py-4 border-b bg-card/50 flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg font-semibold">Segments</h1>
                  <span className="text-[11px] px-2 py-0.5 rounded-full border text-muted-foreground">{segments.length}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Saved audience filters — click one to see its contacts</p>
              </div>
              <div className="flex-1" />
              {canEdit && <button className={btnPri} onClick={openNewSegment}><Plus className="w-3 h-3 inline mr-1" />Create segment</button>}
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {folders.map((f) => {
                const segs = grouped.byFolder.get(f.id) || [];
                if (!segs.length) return null;
                return (
                  <div key={f.id}>
                    <div className="flex items-center gap-2 mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <FolderIcon className="w-3.5 h-3.5" />{f.name}
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                      {segs.map((s) => (
                        <div key={s.id} className="rounded-xl border bg-card shadow-card p-4">
                          <button className="text-sm font-semibold text-primary hover:underline" onClick={() => { setActiveSeg(s.id); setView("contacts"); }}>
                            {s.name}
                          </button>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{describeRules(s, fields)}</p>
                          <div className="flex items-center gap-2 mt-3">
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">{s.count} contacts</span>
                            <div className="flex-1" />
                            {canEdit && <button className={btnGhost} onClick={() => openEditSegment(s)}>Edit</button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {grouped.ungrouped.length > 0 && (
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">No folder</div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
                    {grouped.ungrouped.map((s) => (
                      <div key={s.id} className="rounded-xl border bg-card shadow-card p-4">
                        <button className="text-sm font-semibold text-primary hover:underline" onClick={() => { setActiveSeg(s.id); setView("contacts"); }}>
                          {s.name}
                        </button>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{describeRules(s, fields)}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">{s.count} contacts</span>
                          <div className="flex-1" />
                          {canEdit && <button className={btnGhost} onClick={() => openEditSegment(s)}>Edit</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {segments.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-sm text-muted-foreground mb-3">No segments yet.</p>
                  {canEdit && <button className={btnPri} onClick={openNewSegment}><Plus className="w-3 h-3 inline mr-1" />Create your first segment</button>}
                </div>
              )}
            </div>
          </>
        )}

        {view === "contacts" && (<>
        <div className="px-6 py-4 border-b bg-card/50 flex items-start gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold truncate">{headerName}</h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full border text-muted-foreground shrink-0">{total} contacts</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{headerDesc}</p>
          </div>
          <div className="flex-1" />
          {activeSegment && canEdit && (
            <button className={btnGhost} onClick={() => openEditSegment(activeSegment)}>
              <Pencil className="w-3 h-3 inline mr-1" />Edit filter
            </button>
          )}
        </div>

        <div className="px-6 py-3 border-b bg-card/30 flex items-center gap-2">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className={clsx(inputCls, "pl-9")} />
          </div>
          <div className="flex-1" />
          {canEdit && <button className={btnGhost} onClick={openDupes}><GitMerge className="w-3 h-3 inline mr-1" />Find duplicates</button>}
          <button className={btnGhost} onClick={exportCsv}><Download className="w-3 h-3 inline mr-1" />Export</button>
          {canEdit && (
            <button className={btnPri} onClick={() => { setForm({ phone: "", name: "", city: "", tags: "" }); setFormAttrs({}); setDrawer("add"); }}>
              + Add contact
            </button>
          )}
        </div>

        {importMsg && <div className="px-6 py-2 text-xs text-primary bg-accent/60">{importMsg}</div>}
        {selected.size > 0 && (
          <div className="px-6 py-2 bg-accent flex items-center gap-3 text-sm">
            <span className="font-medium text-accent-foreground">{selected.size} selected</span>
            <button className={btnGhost} onClick={exportCsv}>Export</button>
            {canEdit && <button className="h-8 px-3 rounded-lg bg-destructive text-white text-xs font-medium" onClick={bulkDelete}><Trash2 className="w-3 h-3 inline mr-1" />Delete</button>}
            <button className={btnGhost} onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6 pt-4">
          <div className="rounded-xl border bg-card shadow-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wide border-b bg-muted/40">
                  <th className="pl-4 pr-2 py-3 w-8">
                    <input type="checkbox" checked={selected.size > 0 && selected.size === contacts.length} onChange={() => setSelected(selected.size === contacts.length ? new Set() : new Set(contacts.map((c) => c.id)))} />
                  </th>
                  <th className="px-3 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Phone</th>
                  <th className="px-3 py-3 font-medium">City</th>
                  <th className="px-3 py-3 font-medium">Tags</th>
                  {fields.map((f) => <th key={f.id} className="px-3 py-3 font-medium">{f.label}</th>)}
                  <th className="px-3 py-3 font-medium">Opt-in</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className={clsx("border-b last:border-0 hover:bg-muted/40", selected.has(c.id) && "bg-accent/50")}>
                    <td className="pl-4 pr-2 py-2.5">
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => setSelected((p) => { const n = new Set(p); if (n.has(c.id)) { n.delete(c.id); } else { n.add(c.id); } return n; })} />
                    </td>
                    <td
                      className="px-3 py-2.5 font-medium text-primary hover:underline cursor-pointer"
                      onClick={() => router.push(`/contacts/${c.id}`)}
                    >
                      {c.name || `+${c.phone}`}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">+{c.phone}</td>
                    <td className="px-3 py-2.5">{c.city || "—"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map((t) => <span key={t} className="text-[11px] px-1.5 py-px rounded bg-muted text-muted-foreground">{t}</span>)}
                      </div>
                    </td>
                    {fields.map((f) => <td key={f.id} className="px-3 py-2.5">{c.attributes?.[f.key] ?? "—"}</td>)}
                    <td className="px-3 py-2.5">{c.optedIn ? "yes" : "no"}</td>
                  </tr>
                ))}
                {contacts.length === 0 && (
                  <tr><td colSpan={6 + fields.length} className="px-4 py-6 text-muted-foreground">No contacts match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>)}
      </section>

      {/* Drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => setDrawer(null)}>
          <div className="w-[420px] max-w-[92vw] h-full bg-card border-l flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <span className="font-semibold">
                {drawer === "segment" ? (editingId ? "Edit segment" : "New segment")
                  : drawer === "fields" ? "Custom fields"
                  : drawer === "dupes" ? "Duplicate contacts"
                  : "Add contact"}
              </span>
              <button onClick={() => setDrawer(null)} className="p-1.5 rounded-md hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 text-sm">
              {drawer === "segment" && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Name</label>
                    <input className={clsx(inputCls, "mt-1")} value={segName} onChange={(e) => setSegName(e.target.value)} placeholder="e.g. Bengaluru leads" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Folder</label>
                    <select className={clsx(inputCls, "mt-1")} value={segFolder} onChange={(e) => setSegFolder(e.target.value)}>
                      <option value="">No folder</option>
                      {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    Match
                    <select className="h-8 px-2 rounded-lg border bg-background" value={match} onChange={(e) => setMatch(e.target.value as "all" | "any")}>
                      <option value="all">all</option><option value="any">any</option>
                    </select>
                    of these conditions
                  </div>
                  {conds.map((c, i) => (
                    <div key={i} className="flex gap-2 items-center flex-wrap">
                      <select
                        className="h-9 px-2 rounded-lg border bg-background text-sm"
                        value={c.field}
                        onChange={(e) => { const field = e.target.value; updateCond(i, { field, op: opsFor(field)[0].v, value: field === "optedIn" ? "true" : "" }); }}
                      >
                        {fieldOptions.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
                      </select>
                      <select className="h-9 px-2 rounded-lg border bg-background text-sm" value={c.op} onChange={(e) => updateCond(i, { op: e.target.value as SegOp })}>
                        {opsFor(c.field).map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                      </select>
                      {c.op !== "is_set" && (c.field === "optedIn" ? (
                        <select className="h-9 px-2 rounded-lg border bg-background text-sm" value={String(c.value)} onChange={(e) => updateCond(i, { value: e.target.value })}>
                          <option value="true">yes</option><option value="false">no</option>
                        </select>
                      ) : (
                        <input className="h-9 px-3 rounded-lg border bg-background text-sm flex-1 min-w-24" value={typeof c.value === "string" ? c.value : ""} placeholder="value" onChange={(e) => updateCond(i, { value: e.target.value })} />
                      ))}
                      {conds.length > 1 && <button className={btnGhost} onClick={() => setConds((p) => p.filter((_, idx) => idx !== i))}>×</button>}
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-1">
                    <button className={btnGhost} onClick={() => setConds((p) => [...p, { field: "tag", op: "has", value: "" }])}>+ condition</button>
                    <button className={btnPri} onClick={preview}>Preview</button>
                    {previewCount !== null && <span className="text-xs text-primary font-medium">{previewCount} contacts match</span>}
                  </div>
                </>
              )}

              {drawer === "fields" && (
                <>
                  <p className="text-xs text-muted-foreground">Your own fields appear on contacts, import, table columns and segments.</p>
                  {fields.map((f) => (
                    <div key={f.id} className="flex items-center justify-between py-2 border-b">
                      <span>{f.label}</span>
                      <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive cursor-pointer" onClick={() => api.del(`/contact-fields/${f.id}`).then(loadFields)} />
                    </div>
                  ))}
                  {fields.length === 0 && <p className="text-xs text-muted-foreground">No custom fields yet.</p>}
                  <div className="flex gap-2 pt-2">
                    <input className={inputCls} placeholder="New field, e.g. Budget" value={newField} onChange={(e) => setNewField(e.target.value)} />
                    <button className={btnPri} disabled={!newField.trim()} onClick={() => api.post("/contact-fields", { label: newField.trim(), type: "text" }).then(() => { setNewField(""); loadFields(); })}>Add</button>
                  </div>
                </>
              )}

              {drawer === "dupes" && (
                <>
                  {dupLoading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Scanning…</div>}
                  {!dupLoading && dupGroups && dupGroups.length === 0 && (
                    <p className="text-sm text-muted-foreground">No duplicates found with the current rules. Adjust them in Settings → Merge rules.</p>
                  )}
                  {!dupLoading && dupGroups?.map((g, i) => (
                    <div key={`${g.reason}-${g.key}`} className="rounded-xl border bg-muted/30 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium capitalize">
                          {g.reason === "customField" ? `field: ${g.field}` : g.reason === "nameCity" ? "name + city" : g.reason}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">{g.key}</span>
                      </div>
                      {g.contacts.map((c) => (
                        <label key={c.id} className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`primary-${i}`}
                            checked={(primaries[i] || g.suggestedPrimaryId) === c.id}
                            onChange={() => setPrimaries({ ...primaries, [i]: c.id })}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">
                              {c.name || "Unknown"}
                              {c.id === g.suggestedPrimaryId && <span className="ml-2 text-[10px] text-primary font-semibold">suggested</span>}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">+{c.phone}{c.email ? ` · ${c.email}` : ""}{c.city ? ` · ${c.city}` : ""}</div>
                          </div>
                        </label>
                      ))}
                      <p className="text-[11px] text-muted-foreground">Selected record survives; others merge into it (empty fields filled, tags combined, numbers absorbed).</p>
                      <button className={btnPri} disabled={merging === i} onClick={() => mergeGroup(i)}>
                        {merging === i ? "Merging…" : `Merge ${g.contacts.length} contacts`}
                      </button>
                    </div>
                  ))}
                </>
              )}

              {drawer === "add" && (
                <>
                  {[
                    { k: "phone", label: "Phone", ph: "91…" },
                    { k: "name", label: "Name", ph: "" },
                    { k: "city", label: "City", ph: "" },
                    { k: "tags", label: "Tags (comma separated)", ph: "lead, villa" },
                  ].map((f) => (
                    <div key={f.k}>
                      <label className="text-xs text-muted-foreground">{f.label}</label>
                      <input
                        className={clsx(inputCls, "mt-1")}
                        placeholder={f.ph}
                        value={form[f.k as keyof typeof form]}
                        onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}
                      />
                    </div>
                  ))}
                  {fields.map((f) => (
                    <div key={f.id}>
                      <label className="text-xs text-muted-foreground">{f.label}</label>
                      <input className={clsx(inputCls, "mt-1")} value={formAttrs[f.key] || ""} onChange={(e) => setFormAttrs({ ...formAttrs, [f.key]: e.target.value })} />
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="px-5 py-3.5 border-t flex items-center gap-2">
              {drawer === "segment" && editingId && (
                <button className="h-8 px-3 rounded-lg bg-destructive text-white text-xs font-medium" onClick={() => deleteSegment(editingId)}>Delete</button>
              )}
              <div className="flex-1" />
              <button className={btnGhost} onClick={() => setDrawer(null)}>Cancel</button>
              {drawer === "segment" && <button className={btnPri} disabled={!segName.trim()} onClick={saveSegment}>{editingId ? "Save" : "Create"}</button>}
              {drawer === "add" && <button className={btnPri} disabled={!form.phone.trim()} onClick={addContact}>Save</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
