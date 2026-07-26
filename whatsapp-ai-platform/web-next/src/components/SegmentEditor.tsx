"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Filter, Loader2, Plus, Trash2, Users } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { ContactField, Folder, SegCondition, SegOp, Segment } from "@/lib/types";

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

const input = "w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const label = "text-xs font-medium text-muted-foreground";
const btnPri = "h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted";

export default function SegmentEditor({ segmentId }: { segmentId?: string }) {
  const router = useRouter();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [fields, setFields] = useState<ContactField[]>([]);
  const [loading, setLoading] = useState(!!segmentId);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [folderId, setFolderId] = useState("");
  const [match, setMatch] = useState<"all" | "any">("all");
  const [conds, setConds] = useState<SegCondition[]>([{ field: "city", op: "equals", value: "" }]);
  const [count, setCount] = useState<number | null>(null);
  const [sample, setSample] = useState<{ id: string; name?: string | null; phone: string }[]>([]);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    api.get<{ folders: Folder[] }>("/segment-folders").then((r) => setFolders(r.folders)).catch(() => {});
    api.get<{ fields: ContactField[] }>("/contact-fields").then((r) => setFields(r.fields)).catch(() => {});
    if (!segmentId) return;
    api.get<{ segments: Segment[] }>("/segments")
      .then((r) => {
        const s = r.segments.find((x) => x.id === segmentId);
        if (!s) return;
        setName(s.name);
        setFolderId(s.folderId || "");
        setMatch(s.rules.match);
        setConds(s.rules.conditions.length ? s.rules.conditions : [{ field: "city", op: "equals", value: "" }]);
        setCount(s.count);
      })
      .finally(() => setLoading(false));
  }, [segmentId]);

  const fieldOptions = [...BASE_FIELDS, ...fields.map((f) => ({ v: `attr:${f.key}`, label: f.label }))];
  const cleanRules = useCallback(
    () => ({ match, conditions: conds.filter((c) => c.op === "is_set" || c.value !== "") }),
    [match, conds]
  );

  function updateCond(i: number, patch: Partial<SegCondition>) {
    setConds((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  async function preview() {
    setPreviewing(true);
    try {
      const r = await api.post<{ count: number; sample: { id: string; name?: string | null; phone: string }[] }>(
        "/segments/preview", { rules: cleanRules() }
      );
      setCount(r.count);
      setSample(r.sample);
    } finally { setPreviewing(false); }
  }

  async function save() {
    setErr(null);
    if (!name.trim()) { setErr("Give the segment a name."); return; }
    setSaving(true);
    const body = { name: name.trim(), rules: cleanRules(), folderId: folderId || null };
    try {
      if (segmentId) await api.patch(`/segments/${segmentId}`, body);
      else await api.post("/segments", body);
      router.push("/contacts");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save this segment.");
      setSaving(false);
    }
  }

  async function remove() {
    if (!segmentId || !confirm("Delete this segment?")) return;
    await api.del(`/segments/${segmentId}`);
    router.push("/contacts");
  }

  if (loading) {
    return <div className="flex-1 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-16 shrink-0 border-b bg-card/60 flex items-center gap-3 px-6">
        <button onClick={() => router.push("/contacts")} className="p-2 -ml-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-base font-semibold">{segmentId ? "Edit segment" : "New segment"}</h1>
          <p className="text-xs text-muted-foreground">Contacts matching these rules are always up to date</p>
        </div>
        <div className="flex-1" />
        {err && <span className="text-xs text-destructive mr-2">{err}</span>}
        {segmentId && <button className="h-9 px-4 rounded-lg bg-destructive text-white text-sm font-medium" onClick={remove}>Delete</button>}
        <button className={btnGhost} onClick={() => router.push("/contacts")}>Cancel</button>
        <button className={btnPri} onClick={save} disabled={saving || !name.trim()}>
          {saving && <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />}
          {segmentId ? "Save segment" : "Create segment"}
        </button>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-8 space-y-7">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Details</h2>
              <div>
                <label className={label}>Segment name</label>
                <input className={clsx(input, "mt-1.5")} value={name} onChange={(e) => setName(e.target.value)} placeholder="Bengaluru leads" />
              </div>
              <div>
                <label className={label}>Folder</label>
                <select className={clsx(input, "mt-1.5")} value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                  <option value="">No folder</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Rules</h2>
                <span className="text-xs text-muted-foreground">match</span>
                <select className="h-8 px-2 rounded-lg border bg-background text-xs"
                  value={match} onChange={(e) => setMatch(e.target.value as "all" | "any")}>
                  <option value="all">all</option>
                  <option value="any">any</option>
                </select>
                <span className="text-xs text-muted-foreground">of these</span>
              </div>

              {conds.map((c, i) => (
                <div key={i} className="flex gap-2 items-center flex-wrap rounded-xl border p-3">
                  <select className="h-9 px-2 rounded-lg border bg-background text-sm"
                    value={c.field}
                    onChange={(e) => {
                      const field = e.target.value;
                      updateCond(i, { field, op: opsFor(field)[0].v, value: field === "optedIn" ? "true" : "" });
                    }}>
                    {fieldOptions.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
                  </select>
                  <select className="h-9 px-2 rounded-lg border bg-background text-sm"
                    value={c.op} onChange={(e) => updateCond(i, { op: e.target.value as SegOp })}>
                    {opsFor(c.field).map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                  </select>
                  {c.op !== "is_set" && (c.field === "optedIn" ? (
                    <select className="h-9 px-2 rounded-lg border bg-background text-sm"
                      value={String(c.value)} onChange={(e) => updateCond(i, { value: e.target.value })}>
                      <option value="true">yes</option><option value="false">no</option>
                    </select>
                  ) : (
                    <input className="h-9 px-3 rounded-lg border bg-background text-sm flex-1 min-w-32"
                      value={typeof c.value === "string" ? c.value : ""} placeholder="value"
                      onChange={(e) => updateCond(i, { value: e.target.value })} />
                  ))}
                  {conds.length > 1 && (
                    <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive"
                      onClick={() => setConds((p) => p.filter((_, idx) => idx !== i))}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button className={btnGhost} onClick={() => setConds((p) => [...p, { field: "tag", op: "has", value: "" }])}>
                <Plus className="w-3.5 h-3.5 inline mr-1" />Add condition
              </button>
            </section>
          </div>
        </div>

        {/* live preview */}
        <aside className="w-[340px] shrink-0 border-l bg-muted/20 overflow-y-auto">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">Who matches</h2>
            </div>
            <button className={clsx(btnPri, "w-full")} onClick={preview} disabled={previewing}>
              {previewing ? <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" /> : <Users className="w-3.5 h-3.5 inline mr-1.5" />}
              Preview audience
            </button>
            {count !== null && (
              <>
                <div className="mt-4 rounded-xl border bg-card p-4 text-center">
                  <div className="text-3xl font-semibold text-primary">{count}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">contacts match</div>
                </div>
                {sample.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sample</div>
                    {sample.map((s) => (
                      <div key={s.id} className="rounded-lg border bg-card px-3 py-2">
                        <div className="text-[13px] font-medium">{s.name || "Unknown"}</div>
                        <div className="text-[11px] text-muted-foreground">+{s.phone}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
              Segments are live — as contacts change, who is inside updates automatically.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
