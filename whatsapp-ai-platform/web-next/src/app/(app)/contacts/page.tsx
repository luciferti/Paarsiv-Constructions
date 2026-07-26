"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Folder as FolderIcon, FolderPlus, Plus, Filter, ChevronDown, ChevronRight,
  X, Search, Upload, Download, Trash2, SlidersHorizontal, Pencil, GitMerge, Loader2,
  Tag as TagIcon, Archive,
} from "lucide-react";
import clsx from "clsx";
import { api, download, getSession } from "@/lib/api";
import type { Contact, ContactField, Folder, Segment } from "@/lib/types";
import DateRangeFilter, { rangeQuery, resolveRange, type DateRange } from "@/components/DateRangeFilter";
import Pagination, { EMPTY_PAGE, type PageMeta } from "@/components/Pagination";

const BASE_FIELDS: { v: string; label: string }[] = [
  { v: "city", label: "City" },
  { v: "tag", label: "Tag" },
  { v: "name", label: "Name" },
  { v: "phone", label: "Phone" },
  { v: "email", label: "Email" },
  { v: "optedIn", label: "Opted in" },
];

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

export default function ContactsPage() {
  const router = useRouter();
  const session = typeof window !== "undefined" ? getSession() : null;
  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "RM";

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [meta, setMeta] = useState<PageMeta>(EMPTY_PAGE);
  const total = meta.total;
  const [allCount, setAllCount] = useState(0);
  const [search, setSearch] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [fields, setFields] = useState<ContactField[]>([]);
  const [activeSeg, setActiveSeg] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"contacts" | "segments">("contacts"); // main-area mode
  const [range, setRange] = useState<DateRange>({ preset: "all" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);




  const loadContacts = useCallback(() => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (activeSeg) p.set("segmentId", activeSeg);
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    api.get<{ contacts: Contact[] } & PageMeta>(`/contacts?${p.toString()}${rangeQuery(range)}`)
      .then((r) => {
        setContacts(r.contacts);
        setMeta({ total: r.total, page: r.page, pageSize: r.pageSize, pages: r.pages });
        setSelected(new Set());
        setSelectAllMatching(false);
      })
      .catch(() => {});
  }, [search, activeSeg, range, page, pageSize]);
  const loadAll = useCallback(() => {
    api.get<{ total: number }>("/contacts?pageSize=1").then((r) => setAllCount(r.total)).catch(() => {});
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
  useEffect(() => { setPage(1); }, [search, activeSeg, range]);
  useEffect(loadContacts, [loadContacts]);

  const activeSegment = segments.find((s) => s.id === activeSeg) || null;

  const grouped = useMemo(() => {
    const byFolder = new Map<string, Segment[]>();
    const ungrouped: Segment[] = [];
    for (const s of segments) {
      if (s.folderId) { const a = byFolder.get(s.folderId) || []; a.push(s); byFolder.set(s.folderId, a); }
      else ungrouped.push(s);
    }
    return { byFolder, ungrouped };
  }, [segments]);

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

  /** The filter the server should apply — the same one driving the table. */
  const filterBody = useCallback(() => {
    const { from, to } = resolveRange(range);
    return { search: search || undefined, segmentId: activeSeg || undefined, from, to };
  }, [search, activeSeg, range]);

  async function exportCsv() {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (activeSeg) p.set("segmentId", activeSeg);
    setBulkMsg("Preparing CSV…");
    try {
      await download(`/contacts/export?${p.toString()}${rangeQuery(range)}`, "contacts.csv");
      setBulkMsg(null);
    } catch (e) {
      setBulkMsg(e instanceof Error ? e.message : "Export failed.");
    }
  }

  // ---------- bulk actions ----------
  async function runBulk(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const r = await api.post<{ affected: number }>("/contacts/bulk", {
        ...(selectAllMatching ? { all: true, filter: filterBody() } : { ids: Array.from(selected) }),
        action,
        ...extra,
      });
      setBulkMsg(`${r.affected} contact${r.affected === 1 ? "" : "s"} updated.`);
      setSelected(new Set());
      setSelectAllMatching(false);
      loadContacts(); loadAll(); loadSegments();
    } catch (e) {
      setBulkMsg(e instanceof Error ? e.message : "That bulk action failed.");
    } finally { setBusy(false); }
  }

  const selectionCount = selectAllMatching ? total : selected.size;

  async function bulkTag(action: "addTag" | "removeTag") {
    const tag = prompt(action === "addTag" ? "Tag to add:" : "Tag to remove:");
    if (!tag?.trim()) return;
    await runBulk(action, { tag: tag.trim() });
  }
  async function bulkDelete() {
    if (!confirm(`Delete ${selectionCount} contacts? This cannot be undone.`)) return;
    await runBulk("delete");
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
              <Plus className="w-4 h-4 cursor-pointer hover:text-primary" onClick={(e) => { e.stopPropagation(); router.push("/contacts/segments/new"); }} />
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
            <button onClick={() => router.push('/contacts/fields')} className="w-full flex items-center gap-2 h-8 px-3 rounded-lg text-[13px] text-muted-foreground hover:bg-muted">
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
              {canEdit && <button className={btnPri} onClick={() => router.push('/contacts/segments/new')}><Plus className="w-3 h-3 inline mr-1" />Create segment</button>}
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
                            {canEdit && <button className={btnGhost} onClick={() => router.push(`/contacts/segments/${s.id}`)}>Edit</button>}
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
                          {canEdit && <button className={btnGhost} onClick={() => router.push(`/contacts/segments/${s.id}`)}>Edit</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {segments.length === 0 && (
                <div className="text-center py-16">
                  <p className="text-sm text-muted-foreground mb-3">No segments yet.</p>
                  {canEdit && <button className={btnPri} onClick={() => router.push('/contacts/segments/new')}><Plus className="w-3 h-3 inline mr-1" />Create your first segment</button>}
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
            <button className={btnGhost} onClick={() => router.push(`/contacts/segments/${activeSegment.id}`)}>
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
          <DateRangeFilter value={range} onChange={setRange} />
          {canEdit && <button className={btnGhost} onClick={() => router.push('/contacts/duplicates')}><GitMerge className="w-3 h-3 inline mr-1" />Find duplicates</button>}
          <button className={btnGhost} onClick={exportCsv}><Download className="w-3 h-3 inline mr-1" />Export</button>
          {canEdit && (
            <button className={btnPri} onClick={() => router.push('/contacts/new')}>
              + Add contact
            </button>
          )}
        </div>

        {importMsg && <div className="px-6 py-2 text-xs text-primary bg-accent/60">{importMsg}</div>}
        {bulkMsg && <div className="px-6 py-2 text-xs text-primary bg-accent/60">{bulkMsg}</div>}

        {(selected.size > 0 || selectAllMatching) && (
          <div className="px-6 py-2 bg-accent flex items-center gap-2 text-sm flex-wrap">
            <span className="font-medium text-accent-foreground">
              {busy && <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />}
              {selectionCount} selected
            </span>
            {!selectAllMatching && selected.size === contacts.length && total > contacts.length && (
              <button className="text-xs text-primary underline underline-offset-2" onClick={() => setSelectAllMatching(true)}>
                Select all {total} matching this filter
              </button>
            )}
            {selectAllMatching && (
              <span className="text-xs text-muted-foreground">everything matching the current filter</span>
            )}
            <div className="w-px h-5 bg-border mx-1" />
            {canEdit && <button className={btnGhost} disabled={busy} onClick={() => bulkTag("addTag")}><TagIcon className="w-3 h-3 inline mr-1" />Add tag</button>}
            {canEdit && <button className={btnGhost} disabled={busy} onClick={() => bulkTag("removeTag")}>Remove tag</button>}
            {canEdit && <button className={btnGhost} disabled={busy} onClick={() => runBulk("optOut")}>Mark opted out</button>}
            {canEdit && <button className={btnGhost} disabled={busy} onClick={() => runBulk("optIn")}>Mark opted in</button>}
            {canEdit && <button className={btnGhost} disabled={busy} onClick={() => runBulk("status", { status: "archived" })}><Archive className="w-3 h-3 inline mr-1" />Archive</button>}
            {canEdit && <button className="h-8 px-3 rounded-lg bg-destructive text-white text-xs font-medium disabled:opacity-50" disabled={busy} onClick={bulkDelete}><Trash2 className="w-3 h-3 inline mr-1" />Delete</button>}
            <div className="flex-1" />
            <button className={btnGhost} onClick={() => { setSelected(new Set()); setSelectAllMatching(false); }}>Clear</button>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6 pt-4">
          <div className="rounded-xl border bg-card shadow-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wide border-b bg-muted/40">
                  <th className="pl-4 pr-2 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectAllMatching || (selected.size > 0 && selected.size === contacts.length)}
                      onChange={() => {
                        const clearing = selectAllMatching || selected.size === contacts.length;
                        setSelectAllMatching(false);
                        setSelected(clearing ? new Set() : new Set(contacts.map((c) => c.id)));
                      }}
                    />
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
                      <input type="checkbox" checked={selectAllMatching || selected.has(c.id)} onChange={() => { setSelectAllMatching(false); setSelected((p) => { const n = new Set(p); if (n.has(c.id)) { n.delete(c.id); } else { n.add(c.id); } return n; }); }} />
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
          <Pagination
            meta={meta}
            label="contacts"
            className="mt-4"
            onPage={setPage}
            onPageSize={(n) => { setPageSize(n); setPage(1); }}
          />
        </div>
        </>)}
      </section>

    </div>
  );
}
