"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Filter, Loader2, Plus, Sparkles, Trash2, Users } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { ContactField, Folder, SegCondition, SegOp, Segment } from "@/lib/types";

interface Assessment {
  verdict: "good" | "mixed" | "poor";
  headline: string;
  reasons: string[];
  suggestions: string[];
  engine: string;
  stats: {
    size: number; optedIn: number; optedOut: number; everDelivered: number;
    everReplied: number; addedLast30: number; staleOver90: number;
    readRate: number; replyRate: number;
  };
}

/** Grouped so behaviour and timing are as easy to find as the plain fields. */
const FIELD_GROUPS: { group: string; fields: { v: string; label: string }[] }[] = [
  {
    group: "Who they are",
    fields: [
      { v: "city", label: "City" },
      { v: "country", label: "Country" },
      { v: "company", label: "Company" },
      { v: "name", label: "Name" },
      { v: "phone", label: "Phone" },
      { v: "email", label: "Email" },
      { v: "tag", label: "Tag" },
      { v: "optedIn", label: "Marketing consent" },
    ],
  },
  {
    group: "What they've done",
    fields: [
      { v: "delivered", label: "Messages delivered to them" },
      { v: "read", label: "Messages they read" },
      { v: "replied", label: "Times they replied" },
      { v: "campaign", label: "Was in a campaign" },
      { v: "anyCampaignDelivered", label: "Reached by any campaign" },
    ],
  },
  {
    group: "When",
    fields: [
      { v: "added", label: "Added to contacts" },
      { v: "lastDelivered", label: "Last message delivered" },
      { v: "lastReplied", label: "Last time they replied" },
      { v: "lastCampaign", label: "Last campaign they got" },
    ],
  },
];

const COUNT_FIELDS = ["delivered", "read", "replied"];
const DATE_FIELDS = ["added", "lastDelivered", "lastReplied", "lastCampaign"];

function opsFor(field: string): { v: SegOp; label: string }[] {
  if (field === "tag") return [{ v: "has", label: "has" }];
  if (field === "optedIn") return [{ v: "equals", label: "is" }];
  if (field === "anyCampaignDelivered") return [{ v: "equals", label: "is true" }];
  if (field === "campaign") return [
    { v: "in_campaign", label: "was in" },
    { v: "not_in_campaign", label: "was not in" },
  ];
  if (COUNT_FIELDS.includes(field)) return [
    { v: "at_least", label: "at least" },
    { v: "at_most", label: "at most" },
  ];
  if (DATE_FIELDS.includes(field)) return [
    { v: "within_days", label: "in the last" },
    { v: "not_within_days", label: "not in the last" },
  ];
  return [
    { v: "contains", label: "contains" },
    { v: "equals", label: "equals" },
    { v: "not_equals", label: "not equals" },
    { v: "is_set", label: "is set" },
  ];
}

/** The default a field should start with when it's picked. */
function defaultFor(field: string): { op: SegOp; value: string | boolean | number } {
  if (field === "optedIn") return { op: "equals", value: "true" };
  if (field === "anyCampaignDelivered") return { op: "equals", value: true };
  if (field === "campaign") return { op: "in_campaign", value: "" };
  if (COUNT_FIELDS.includes(field)) return { op: "at_least", value: 1 };
  if (DATE_FIELDS.includes(field)) return { op: "within_days", value: 30 };
  if (field === "tag") return { op: "has", value: "" };
  return { op: "equals", value: "" };
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
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [describeText, setDescribeText] = useState("");
  const [describing, setDescribing] = useState(false);
  const [describeNote, setDescribeNote] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [assessing, setAssessing] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [sample, setSample] = useState<{ id: string; name?: string | null; phone: string }[]>([]);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    api.get<{ folders: Folder[] }>("/segment-folders").then((r) => setFolders(r.folders)).catch(() => {});
    api.get<{ fields: ContactField[] }>("/contact-fields").then((r) => setFields(r.fields)).catch(() => {});
    api.get<{ campaigns: { id: string; name: string }[] }>("/segments/options")
      .then((r) => setCampaigns(r.campaigns)).catch(() => {});
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

  const groups = [
    ...FIELD_GROUPS,
    ...(fields.length
      ? [{ group: "Your custom fields", fields: fields.map((f) => ({ v: `attr:${f.key}`, label: f.label })) }]
      : []),
  ];
  const cleanRules = useCallback(
    () => ({
      match,
      conditions: conds.filter(
        (c) => c.op === "is_set" || c.field === "anyCampaignDelivered" || (c.value !== "" && c.value !== undefined)
      ),
    }),
    [match, conds]
  );

  function updateCond(i: number, patch: Partial<SegCondition>) {
    setConds((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  /** Describe the audience in words; the builder fills itself in. */
  async function describe() {
    if (!describeText.trim()) return;
    setDescribing(true); setDescribeNote(null); setErr(null);
    try {
      const r = await api.post<{
        rules: { match: "all" | "any"; conditions: SegCondition[] };
        name: string; explanation: string; engine: string; count: number;
      }>("/segments/describe", { text: describeText.trim() });

      if (!r.rules.conditions.length) {
        setDescribeNote(r.explanation || "Couldn't turn that into rules — try naming a field, a city or a number of days.");
        return;
      }
      setMatch(r.rules.match);
      setConds(r.rules.conditions);
      if (!name.trim()) setName(r.name);
      setCount(r.count);
      setDescribeNote(
        `${r.explanation}${r.engine === "rules" ? " (read from keywords — connect an AI key in Settings for a fuller reading)" : ""}`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not read that description.");
    } finally { setDescribing(false); }
  }

  /** Is this audience worth sending to? Figures come from the database. */
  async function assess() {
    setAssessing(true); setErr(null);
    try {
      const r = await api.post<{ assessment: Assessment }>("/segments/assess", {
        rules: cleanRules(), name: name.trim() || undefined,
      });
      setAssessment(r.assessment);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not assess this segment.");
    } finally { setAssessing(false); }
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

            <section className="rounded-xl border bg-accent/30 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold">Describe it instead</h2>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Say who you want in plain words and the rules below fill themselves in — then check them.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  className={clsx(input, "flex-1")}
                  placeholder="Bengaluru ke log jo last month add hue aur 2 baar se zyada delivery hui"
                  value={describeText}
                  onChange={(e) => setDescribeText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && describe()}
                />
                <button className={btnPri} onClick={describe} disabled={describing || !describeText.trim()}>
                  {describing ? <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />}
                  Build it
                </button>
              </div>
              {describeNote && <p className="text-[11px] text-muted-foreground mt-2">{describeNote}</p>}
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
                      updateCond(i, { field, ...defaultFor(field) });
                    }}>
                    {groups.map((g) => (
                      <optgroup key={g.group} label={g.group}>
                        {g.fields.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <select className="h-9 px-2 rounded-lg border bg-background text-sm"
                    value={c.op} onChange={(e) => updateCond(i, { op: e.target.value as SegOp })}>
                    {opsFor(c.field).map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                  </select>

                  {/* the value editor depends on what kind of field it is */}
                  {c.field === "anyCampaignDelivered" ? null
                  : c.op === "is_set" ? null
                  : c.field === "optedIn" ? (
                    <select className="h-9 px-2 rounded-lg border bg-background text-sm"
                      value={String(c.value)} onChange={(e) => updateCond(i, { value: e.target.value })}>
                      <option value="true">opted in</option>
                      <option value="false">opted out</option>
                    </select>
                  ) : c.field === "campaign" ? (
                    <select className="h-9 px-2 rounded-lg border bg-background text-sm flex-1 min-w-40"
                      value={String(c.value ?? "")} onChange={(e) => updateCond(i, { value: e.target.value })}>
                      <option value="">Pick a campaign</option>
                      {campaigns.map((cp) => <option key={cp.id} value={cp.id}>{cp.name}</option>)}
                    </select>
                  ) : COUNT_FIELDS.includes(c.field) ? (
                    <div className="flex items-center gap-1.5">
                      <input type="number" min={0} className="h-9 px-3 w-20 rounded-lg border bg-background text-sm"
                        value={Number(c.value ?? 0)}
                        onChange={(e) => updateCond(i, { value: Number(e.target.value) })} />
                      <span className="text-xs text-muted-foreground">times</span>
                    </div>
                  ) : DATE_FIELDS.includes(c.field) ? (
                    <div className="flex items-center gap-1.5">
                      <input type="number" min={1} className="h-9 px-3 w-20 rounded-lg border bg-background text-sm"
                        value={Number(c.value ?? 30)}
                        onChange={(e) => updateCond(i, { value: Number(e.target.value) })} />
                      <span className="text-xs text-muted-foreground">days</span>
                    </div>
                  ) : (
                    <input className="h-9 px-3 rounded-lg border bg-background text-sm flex-1 min-w-32"
                      value={typeof c.value === "string" ? c.value : ""} placeholder="value"
                      onChange={(e) => updateCond(i, { value: e.target.value })} />
                  )}
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
            <div className="mt-4 pt-4 border-t">
              <button className={clsx(btnGhost, "w-full")} onClick={assess} disabled={assessing}>
                {assessing ? <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 inline mr-1.5" />}
                Is this worth sending to?
              </button>

              {assessment && (
                <div className="mt-3 space-y-3">
                  <div className={clsx(
                    "rounded-xl border p-3",
                    assessment.verdict === "good" ? "border-success/40 bg-success/10"
                    : assessment.verdict === "mixed" ? "border-warning/40 bg-warning/10"
                    : "border-destructive/40 bg-destructive/10"
                  )}>
                    <div className={clsx(
                      "text-[11px] font-semibold uppercase tracking-wide",
                      assessment.verdict === "good" ? "text-success"
                      : assessment.verdict === "mixed" ? "text-warning" : "text-destructive"
                    )}>
                      {assessment.verdict === "good" ? "Worth sending" : assessment.verdict === "mixed" ? "Mixed" : "Low return expected"}
                    </div>
                    <p className="text-xs mt-1 leading-relaxed">{assessment.headline}</p>
                  </div>

                  {assessment.reasons.length > 0 && (
                    <ul className="space-y-1.5">
                      {assessment.reasons.map((r) => (
                        <li key={r} className="text-[11px] text-muted-foreground leading-relaxed flex gap-1.5">
                          <span className="text-muted-foreground/60">·</span>{r}
                        </li>
                      ))}
                    </ul>
                  )}

                  {assessment.suggestions.length > 0 && (
                    <div className="rounded-lg border bg-card p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        What would help
                      </div>
                      <ul className="mt-1.5 space-y-1.5">
                        {assessment.suggestions.map((x) => (
                          <li key={x} className="text-[11px] leading-relaxed flex gap-1.5">
                            <span className="text-primary">→</span>{x}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      ["Will receive", assessment.stats.optedIn],
                      ["Opted out", assessment.stats.optedOut],
                      ["Reached before", assessment.stats.everDelivered],
                      ["Have replied", assessment.stats.everReplied],
                    ].map(([l, v]) => (
                      <div key={String(l)} className="rounded-lg border bg-card px-2.5 py-1.5">
                        <div className="text-sm font-semibold">{Number(v).toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground">{l}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Figures are counted from your data. {assessment.engine === "rules" ? "Wording is rule-based — connect an AI key for a sharper read." : "Wording by AI."}
                  </p>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
              Segments are live — as contacts change, who is inside updates automatically.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
