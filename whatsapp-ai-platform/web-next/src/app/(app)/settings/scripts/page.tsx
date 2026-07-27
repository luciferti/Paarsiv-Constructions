"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BookOpen, Check, Code2, Copy, Loader2, Play, Plus, Save, Trash2, X, Zap,
} from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";

interface Script {
  id: string;
  name: string;
  description?: string | null;
  code: string;
  trigger: string;
  enabled: boolean;
  url?: string | null;
  runs: number;
  failures: number;
  lastRunAt?: string | null;
  lastError?: string | null;
}
interface TriggerDef { key: string; label: string; desc: string }
interface RunResult {
  status: "ok" | "failed" | "timeout";
  durationMs: number;
  logs: string[];
  result?: unknown;
  error?: string;
}
interface ScriptRun {
  id: string; status: string; durationMs?: number | null; trigger?: string | null;
  logs?: string | null; result?: string | null; error?: string | null; createdAt: string;
}

const input = "w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const btnPri = "h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-50";

/** What a script can reach — kept next to the editor so it isn't a guess. */
const SDK = [
  { sig: "input", what: "Whatever set the script off — the message, the contact, the posted body" },
  { sig: "log(...things)", what: "Shows up in the output below and in the run history" },
  { sig: "await http.get(url, headers?)", what: "" },
  { sig: "await http.post(url, body?, headers?)", what: "→ { ok, status, body, json }" },
  { sig: "await whatsapp.send(phone, text)", what: "Lands in the inbox thread like any other message" },
  { sig: "await contacts.find(phone)", what: "The whole contact, or null" },
  { sig: "await contacts.update(phone, fields)", what: "name, email, city, company… and attributes" },
  { sig: "await contacts.tag(phone, tag)", what: "" },
  { sig: "return anything", what: "Stored with the run, and returned to a URL caller" },
];

export default function ScriptsPage() {
  const router = useRouter();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [triggers, setTriggers] = useState<TriggerDef[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", description: "", code: "", trigger: "manual" });
  const [testInput, setTestInput] = useState('{ "phone": "919810000001", "name": "Ravi" }');
  const [result, setResult] = useState<RunResult | null>(null);
  const [history, setHistory] = useState<ScriptRun[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSdk, setShowSdk] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api.get<{ scripts: Script[]; triggers: TriggerDef[] }>("/scripts")
      .then((r) => {
        setScripts(r.scripts);
        setTriggers(r.triggers);
        setSelected((cur) => cur ?? r.scripts[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  const active = scripts.find((s) => s.id === selected) || null;

  // Keyed on the id so reloading after a run doesn't wipe the editor or output.
  useEffect(() => {
    if (!selected) return;
    const s = scripts.find((x) => x.id === selected);
    if (!s) return;
    setDraft({ name: s.name, description: s.description || "", code: s.code, trigger: s.trigger });
    setResult(null);
    setShowHistory(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function create() {
    setBusy("new"); setErr(null);
    try {
      const name = `Script ${scripts.length + 1}`;
      const r = await api.post<{ script: Script }>("/scripts", { name, trigger: "manual" });
      load();
      setSelected(r.script.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create it.");
    } finally { setBusy(null); }
  }

  async function save() {
    if (!active) return;
    setBusy("save"); setErr(null);
    try {
      await api.patch(`/scripts/${active.id}`, {
        name: draft.name.trim() || active.name,
        description: draft.description || null,
        code: draft.code,
        trigger: draft.trigger,
      });
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally { setBusy(null); }
  }

  async function run() {
    if (!active) return;
    setBusy("run"); setErr(null); setResult(null);
    let parsedInput: unknown = {};
    if (testInput.trim()) {
      try { parsedInput = JSON.parse(testInput); }
      catch { setErr("The test input isn't valid JSON."); setBusy(null); return; }
    }
    try {
      const r = await api.post<{ result: RunResult }>(`/scripts/${active.id}/run`, {
        code: draft.code,
        input: parsedInput,
      });
      setResult(r.result);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not run it.");
    } finally { setBusy(null); }
  }

  async function toggle() {
    if (!active) return;
    await api.patch(`/scripts/${active.id}`, { enabled: !active.enabled });
    load();
  }

  async function remove() {
    if (!active || !confirm(`Delete "${active.name}"?`)) return;
    await api.del(`/scripts/${active.id}`);
    setSelected(null);
    load();
  }

  async function openHistory() {
    if (!active) return;
    if (showHistory) { setShowHistory(false); return; }
    const r = await api.get<{ runs: ScriptRun[] }>(`/scripts/${active.id}/runs`);
    setHistory(r.runs);
    setShowHistory(true);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-16 shrink-0 border-b bg-card/60 flex items-center gap-3 px-6">
        <button onClick={() => router.push("/settings")} className="p-2 -ml-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-base font-semibold">Scripts</h1>
          <p className="text-xs text-muted-foreground">Your own code — call any API, then message the customer</p>
        </div>
        <div className="flex-1" />
        <button className={btnGhost} onClick={() => setShowSdk((v) => !v)}>
          <BookOpen className="w-3.5 h-3.5 inline mr-1.5" />What you can use
        </button>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <aside className="w-56 shrink-0 border-r bg-card overflow-y-auto p-3">
          <div className="flex items-center gap-2 px-1 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex-1">Scripts</span>
            <button className="p-1 rounded-md hover:bg-muted" onClick={create} disabled={busy !== null} title="New script">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {scripts.map((s) => (
            <button key={s.id} onClick={() => setSelected(s.id)}
              className={clsx("w-full text-left rounded-lg px-3 py-2 mb-1",
                selected === s.id ? "bg-accent" : "hover:bg-muted")}>
              <div className="flex items-center gap-2">
                <Code2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-[13px] font-medium truncate flex-1">{s.name}</span>
                {s.enabled && <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />}
              </div>
              <span className="block text-[10px] text-muted-foreground mt-0.5">
                {triggers.find((t) => t.key === s.trigger)?.label || s.trigger}
              </span>
            </button>
          ))}
          {scripts.length === 0 && (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              Nothing here yet. Create one to glue this to whatever you already run.
            </p>
          )}
        </aside>

        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-8 space-y-5">
            {err && <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</div>}

            {showSdk && (
              <section className="rounded-xl border bg-card shadow-card overflow-hidden">
                <div className="px-5 py-3 border-b bg-muted/30 flex items-center">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex-1">
                    Available in every script
                  </span>
                  <button className="p-1 rounded hover:bg-muted" onClick={() => setShowSdk(false)}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="divide-y">
                  {SDK.map((s) => (
                    <div key={s.sig} className="px-5 py-2.5 flex items-baseline gap-3">
                      <code className="text-[11.5px] font-mono text-primary shrink-0">{s.sig}</code>
                      <span className="text-[11px] text-muted-foreground">{s.what}</span>
                    </div>
                  ))}
                </div>
                <p className="px-5 py-3 text-[11px] text-muted-foreground border-t leading-relaxed">
                  Ten seconds per run, twenty HTTP calls, and no access to private addresses. There is
                  no <code>require</code> — everything you need is above.
                </p>
              </section>
            )}

            {!active && !showSdk && (
              <div className="rounded-2xl border border-dashed p-12 text-center">
                <Code2 className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium mt-4">Write the glue yourself</p>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
                  Fetch from someone&apos;s API, decide what it means, message the customer, save the
                  answer on their contact. Runs on an event, on a URL you call, or when you press Run.
                </p>
                <button className={clsx(btnPri, "mt-5")} onClick={create}>New script</button>
              </div>
            )}

            {active && (
              <>
                <section className="rounded-xl border bg-card shadow-card p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <input className="flex-1 h-9 px-3 rounded-lg border bg-background text-sm font-medium outline-none focus:ring-2 focus:ring-ring"
                      value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    <button className={clsx(btnGhost, active.enabled && "border-success text-success")}
                      onClick={toggle}>
                      {active.enabled ? "On" : "Off"}
                    </button>
                    <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive" onClick={remove}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <input className={input} placeholder="What does it do? (optional)"
                    value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">When should it run?</label>
                    <select className={clsx(input, "mt-1.5")} value={draft.trigger}
                      onChange={(e) => setDraft({ ...draft, trigger: e.target.value })}>
                      {triggers.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {triggers.find((t) => t.key === draft.trigger)?.desc}
                    </p>
                  </div>

                  {active.trigger === "http" && active.url && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">POST here to run it</label>
                      <div className="mt-1.5 flex items-center gap-2">
                        <code className="flex-1 text-[11px] bg-muted/50 border rounded-lg px-3 py-2 break-all">{active.url}</code>
                        <button className="h-8 px-2.5 rounded-md border text-xs hover:bg-muted shrink-0"
                          onClick={() => { navigator.clipboard?.writeText(active.url!); setCopied(true); setTimeout(() => setCopied(false), 1400); }}>
                          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        The posted body arrives as <code>input.body</code>. Whatever you return is the response.
                        It only works while the script is On.
                      </p>
                    </div>
                  )}
                </section>

                <section className="rounded-xl border bg-card shadow-card overflow-hidden">
                  <div className="px-5 py-2.5 border-b bg-muted/30 flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex-1">Code</span>
                    <span className="text-[10px] text-muted-foreground">
                      {active.runs} runs{active.failures > 0 ? ` · ${active.failures} failed` : ""}
                    </span>
                  </div>
                  <textarea
                    className="w-full h-80 p-4 bg-background font-mono text-[12.5px] leading-relaxed outline-none resize-y"
                    spellCheck={false}
                    value={draft.code}
                    onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                  />
                </section>

                <section className="rounded-xl border bg-card shadow-card p-5 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Test input — what <code>input</code> will be
                    </label>
                    <textarea
                      className={clsx(input, "mt-1.5 h-20 py-2 font-mono text-[12px] resize-y")}
                      value={testInput} onChange={(e) => setTestInput(e.target.value)} spellCheck={false}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button className={btnGhost} onClick={openHistory}>
                      {showHistory ? "Hide history" : "History"}
                    </button>
                    <div className="flex-1" />
                    <button className={btnGhost} onClick={save} disabled={busy !== null}>
                      {busy === "save" ? <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 inline mr-1.5" />}
                      Save
                    </button>
                    <button className={btnPri} onClick={run} disabled={busy !== null}>
                      {busy === "run" ? <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" /> : <Play className="w-3.5 h-3.5 inline mr-1.5" />}
                      Run
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Run uses what&apos;s in the editor right now, and really does send messages — try it on
                    your own number first.
                  </p>
                </section>

                {result && (
                  <section className="rounded-xl border bg-card shadow-card overflow-hidden">
                    <div className="px-5 py-3 border-b bg-muted/30 flex items-center gap-3">
                      <span className={clsx(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        result.status === "ok" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                      )}>
                        {result.status === "ok" ? <Check className="w-3 h-3 inline mr-1" /> : <X className="w-3 h-3 inline mr-1" />}
                        {result.status}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{result.durationMs} ms</span>
                    </div>
                    {result.error && <p className="px-5 py-3 text-sm text-destructive border-b font-mono">{result.error}</p>}
                    {result.logs.length > 0 && (
                      <div className="border-b">
                        <div className="px-5 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Output</div>
                        <pre className="px-5 pb-3 pt-1 text-[11.5px] font-mono overflow-x-auto text-muted-foreground">
                          {result.logs.join("\n")}
                        </pre>
                      </div>
                    )}
                    {result.result !== undefined && result.result !== null && (
                      <div>
                        <div className="px-5 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Returned</div>
                        <pre className="px-5 pb-4 pt-1 text-[11.5px] font-mono overflow-x-auto text-muted-foreground">
                          {JSON.stringify(result.result, null, 2)}
                        </pre>
                      </div>
                    )}
                  </section>
                )}

                {showHistory && (
                  <section className="rounded-xl border bg-card shadow-card overflow-hidden">
                    <div className="px-5 py-3 border-b bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Recent runs
                    </div>
                    <div className="divide-y max-h-80 overflow-y-auto">
                      {history.map((r) => (
                        <div key={r.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
                          <span className={clsx("text-[10px] px-1.5 py-px rounded font-medium shrink-0",
                            r.status === "ok" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                            {r.status}
                          </span>
                          <span className="text-[11px] text-muted-foreground w-20 shrink-0">{r.trigger}</span>
                          <span className="flex-1 truncate text-muted-foreground font-mono">
                            {r.error || r.result || r.logs || "—"}
                          </span>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {r.durationMs} ms · {new Date(r.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                      {history.length === 0 && <p className="px-5 py-4 text-xs text-muted-foreground">Never run yet.</p>}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
