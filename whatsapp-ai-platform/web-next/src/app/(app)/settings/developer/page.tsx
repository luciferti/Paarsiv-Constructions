"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, Clock, Globe, Loader2, Play, Plus, Server, Trash2, X,
} from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { Contact } from "@/lib/types";

interface SavedRequest {
  id: string;
  name: string;
  method: string;
  path: string;
  bodyTemplate?: string | null;
  saveTo?: Record<string, string> | null;
  lastStatus?: number | null;
  lastError?: string | null;
  lastRunAt?: string | null;
}
interface ExternalApi {
  id: string;
  name: string;
  baseUrl: string;
  authType: string;
  authName?: string | null;
  hasSecret: boolean;
  headers?: Record<string, string> | null;
  active: boolean;
  requests: SavedRequest[];
}
interface RunResult {
  ok: boolean;
  statusCode?: number;
  durationMs: number;
  url: string;
  requestBody?: string;
  response?: string;
  error?: string;
  saved?: Record<string, string>;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const input = "w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const label = "text-xs font-medium text-muted-foreground";
const btnPri = "h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-50";

/** Tokens the request builder can fill from the contact it runs for. */
const TOKENS = ["name", "phone", "email", "city", "country", "company", "externalId"];

export default function DeveloperPage() {
  const router = useRouter();
  const [apis, setApis] = useState<ExternalApi[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedApi, setSelectedApi] = useState<string | null>(null);
  const [selectedReq, setSelectedReq] = useState<string | null>(null);
  const [addingApi, setAddingApi] = useState(false);
  const [apiForm, setApiForm] = useState({
    name: "", baseUrl: "", authType: "none", authName: "", authValue: "",
  });
  const [reqForm, setReqForm] = useState({ name: "", method: "GET", path: "/", bodyTemplate: "", saveTo: "" });
  const [runAs, setRunAs] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<{ apis: ExternalApi[] }>("/external-apis")
      .then((r) => {
        setApis(r.apis);
        setSelectedApi((cur) => cur ?? r.apis[0]?.id ?? null);
      })
      .catch(() => {});
    api.get<{ contacts: Contact[] }>("/contacts?pageSize=25")
      .then((r) => setContacts(r.contacts)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const activeApi = apis.find((a) => a.id === selectedApi) || null;
  const activeReq = activeApi?.requests.find((r) => r.id === selectedReq) || null;

  // Keyed on the id, not the object: reloading the list after a run gives a
  // fresh object every time, and resetting on that would wipe the response
  // the user just asked for.
  useEffect(() => {
    if (!selectedReq) return;
    const r = apis.flatMap((a) => a.requests).find((x) => x.id === selectedReq);
    if (!r) return;
    setReqForm({
      name: r.name,
      method: r.method,
      path: r.path,
      bodyTemplate: r.bodyTemplate || "",
      saveTo: r.saveTo ? JSON.stringify(r.saveTo, null, 2) : "",
    });
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReq]);

  async function createApi() {
    setBusy("api"); setErr(null);
    try {
      await api.post("/external-apis", {
        name: apiForm.name.trim(),
        baseUrl: apiForm.baseUrl.trim(),
        authType: apiForm.authType,
        authName: apiForm.authName.trim() || undefined,
        authValue: apiForm.authValue.trim() || undefined,
      });
      setAddingApi(false);
      setApiForm({ name: "", baseUrl: "", authType: "none", authName: "", authValue: "" });
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add that API.");
    } finally { setBusy(null); }
  }

  async function removeApi(a: ExternalApi) {
    if (!confirm(`Delete "${a.name}" and its ${a.requests.length} requests?`)) return;
    await api.del(`/external-apis/${a.id}`);
    setSelectedApi(null); setSelectedReq(null);
    load();
  }

  async function newRequest() {
    if (!activeApi) return;
    const r = await api.post<{ request: SavedRequest }>(`/external-apis/${activeApi.id}/requests`, {
      name: "Untitled request", method: "GET", path: "/",
    });
    load();
    setSelectedReq(r.request.id);
  }

  function parsedSaveTo(): Record<string, string> | undefined {
    if (!reqForm.saveTo.trim()) return {};
    try {
      const v = JSON.parse(reqForm.saveTo);
      return typeof v === "object" && v && !Array.isArray(v) ? v : undefined;
    } catch { return undefined; }
  }

  async function saveRequest() {
    if (!activeReq) return;
    const saveTo = parsedSaveTo();
    if (saveTo === undefined) { setErr("The response mapping isn't valid JSON."); return; }
    setBusy("save"); setErr(null);
    try {
      await api.patch(`/external-apis/requests/${activeReq.id}`, {
        name: reqForm.name.trim() || "Untitled request",
        method: reqForm.method,
        path: reqForm.path,
        bodyTemplate: reqForm.bodyTemplate || null,
        saveTo,
      });
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally { setBusy(null); }
  }

  async function run(dryRun: boolean) {
    if (!activeReq) return;
    setBusy("run"); setErr(null); setResult(null);
    try {
      await saveRequest(); // send what's on screen, not what was saved before
      const r = await api.post<{ result: RunResult }>(`/external-apis/requests/${activeReq.id}/run`, {
        contactId: runAs || undefined,
        dryRun,
      });
      setResult(r.result);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The call could not be made.");
    } finally { setBusy(null); }
  }

  async function removeRequest(r: SavedRequest) {
    if (!confirm(`Delete "${r.name}"?`)) return;
    await api.del(`/external-apis/requests/${r.id}`);
    setSelectedReq(null);
    load();
  }

  function insertToken(t: string) {
    setReqForm((p) => ({ ...p, path: `${p.path}{{${t}}}` }));
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-16 shrink-0 border-b bg-card/60 flex items-center gap-3 px-6">
        <button onClick={() => router.push("/settings")} className="p-2 -ml-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-base font-semibold">Developer console</h1>
          <p className="text-xs text-muted-foreground">Call any API from here — try it, save it, use it in a journey</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* APIs + their requests */}
        <aside className="w-64 shrink-0 border-r bg-card overflow-y-auto p-3">
          <div className="flex items-center gap-2 px-1 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex-1">APIs</span>
            <button className="p-1 rounded-md hover:bg-muted" onClick={() => setAddingApi(true)} title="Add an API">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {apis.map((a) => (
            <div key={a.id} className="mb-1">
              <button
                onClick={() => { setSelectedApi(a.id); setSelectedReq(null); }}
                className={clsx(
                  "w-full text-left rounded-lg px-3 py-2 group",
                  selectedApi === a.id ? "bg-accent" : "hover:bg-muted"
                )}
              >
                <div className="flex items-center gap-2">
                  <Server className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[13px] font-medium truncate flex-1">{a.name}</span>
                </div>
                <span className="block text-[10px] text-muted-foreground truncate mt-0.5">{a.baseUrl}</span>
              </button>

              {selectedApi === a.id && (
                <div className="pl-3 mt-1 space-y-0.5">
                  {a.requests.map((r) => (
                    <button key={r.id} onClick={() => setSelectedReq(r.id)}
                      className={clsx(
                        "w-full flex items-center gap-2 rounded-md px-2 h-7 text-[12px]",
                        selectedReq === r.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted"
                      )}>
                      <span className="text-[9px] font-mono w-9 shrink-0">{r.method}</span>
                      <span className="truncate flex-1 text-left">{r.name}</span>
                      {r.lastStatus != null && (
                        <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0",
                          r.lastStatus < 400 ? "bg-success" : "bg-destructive")} />
                      )}
                    </button>
                  ))}
                  <button className="w-full text-left rounded-md px-2 h-7 text-[12px] text-muted-foreground hover:bg-muted"
                    onClick={newRequest}>
                    <Plus className="w-3 h-3 inline mr-1" />New request
                  </button>
                  <button className="w-full text-left rounded-md px-2 h-7 text-[12px] text-muted-foreground hover:bg-muted hover:text-destructive"
                    onClick={() => removeApi(a)}>
                    <Trash2 className="w-3 h-3 inline mr-1" />Delete API
                  </button>
                </div>
              )}
            </div>
          ))}

          {apis.length === 0 && !addingApi && (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              No APIs yet. Add one to start calling it from journeys.
            </p>
          )}
        </aside>

        {/* console */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-8 space-y-5">
            {err && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</div>
            )}

            {addingApi && (
              <section className="rounded-xl border bg-card shadow-card p-6 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold">Add an API</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Describe it once — the address and how it authenticates. Individual calls come next.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={label}>Name</label>
                    <input className={clsx(input, "mt-1.5")} placeholder="Loan engine"
                      value={apiForm.name} onChange={(e) => setApiForm({ ...apiForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label className={label}>Base URL</label>
                    <input className={clsx(input, "mt-1.5")} placeholder="https://api.yourcompany.com"
                      value={apiForm.baseUrl} onChange={(e) => setApiForm({ ...apiForm, baseUrl: e.target.value })} />
                  </div>
                  <div>
                    <label className={label}>How does it authenticate?</label>
                    <select className={clsx(input, "mt-1.5")} value={apiForm.authType}
                      onChange={(e) => setApiForm({ ...apiForm, authType: e.target.value })}>
                      <option value="none">No auth</option>
                      <option value="header">API key in a header</option>
                      <option value="bearer">Bearer token</option>
                      <option value="basic">Basic (user:password)</option>
                    </select>
                  </div>
                  {apiForm.authType === "header" && (
                    <div>
                      <label className={label}>Header name</label>
                      <input className={clsx(input, "mt-1.5")} placeholder="X-Api-Key"
                        value={apiForm.authName} onChange={(e) => setApiForm({ ...apiForm, authName: e.target.value })} />
                    </div>
                  )}
                  {apiForm.authType !== "none" && (
                    <div className="sm:col-span-2">
                      <label className={label}>
                        {apiForm.authType === "basic" ? "user:password" : "Secret"}
                      </label>
                      <input className={clsx(input, "mt-1.5")} type="password"
                        value={apiForm.authValue} onChange={(e) => setApiForm({ ...apiForm, authValue: e.target.value })} />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Kept server-side and never sent back to this screen.
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button className={btnGhost} onClick={() => setAddingApi(false)}>Cancel</button>
                  <div className="flex-1" />
                  <button className={btnPri} onClick={createApi}
                    disabled={busy !== null || !apiForm.name.trim() || !apiForm.baseUrl.trim()}>
                    {busy === "api" && <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />}Add API
                  </button>
                </div>
              </section>
            )}

            {!addingApi && !activeReq && (
              <div className="rounded-2xl border border-dashed p-12 text-center">
                <Globe className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium mt-4">
                  {activeApi ? "Pick a request, or create one" : "Add an API to get started"}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
                  Anything that speaks HTTP works — your own backend, a credit check, an inventory
                  lookup. Save a call here and a journey can run it mid-conversation, filling it in
                  with the contact it&apos;s talking to.
                </p>
                {activeApi && <button className={clsx(btnPri, "mt-5")} onClick={newRequest}>New request</button>}
              </div>
            )}

            {activeReq && activeApi && (
              <>
                <section className="rounded-xl border bg-card shadow-card p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <input className="flex-1 h-9 px-3 rounded-lg border bg-background text-sm font-medium outline-none focus:ring-2 focus:ring-ring"
                      value={reqForm.name} onChange={(e) => setReqForm({ ...reqForm, name: e.target.value })} />
                    <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive"
                      onClick={() => removeRequest(activeReq)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <select className="h-10 px-2 rounded-lg border bg-background text-sm font-mono w-28"
                      value={reqForm.method} onChange={(e) => setReqForm({ ...reqForm, method: e.target.value })}>
                      {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <div className="flex-1 flex items-center rounded-lg border bg-background overflow-hidden">
                      <span className="px-3 text-xs text-muted-foreground border-r h-10 flex items-center shrink-0 max-w-[45%] truncate">
                        {activeApi.baseUrl}
                      </span>
                      <input className="flex-1 h-10 px-3 bg-transparent text-sm outline-none font-mono"
                        value={reqForm.path} placeholder="/customers/{{phone}}"
                        onChange={(e) => setReqForm({ ...reqForm, path: e.target.value })} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-muted-foreground">Insert:</span>
                    {TOKENS.map((t) => (
                      <button key={t} onClick={() => insertToken(t)}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded border text-muted-foreground hover:bg-muted">
                        {`{{${t}}}`}
                      </button>
                    ))}
                    <span className="text-[11px] text-muted-foreground ml-1">
                      — filled from the contact when it runs
                    </span>
                  </div>

                  {reqForm.method !== "GET" && reqForm.method !== "DELETE" && (
                    <div>
                      <label className={label}>Body (JSON, tokens allowed)</label>
                      <textarea
                        className={clsx(input, "mt-1.5 h-28 py-2 font-mono text-[12px] resize-y")}
                        placeholder={'{ "phone": "{{phone}}", "name": "{{name}}" }'}
                        value={reqForm.bodyTemplate}
                        onChange={(e) => setReqForm({ ...reqForm, bodyTemplate: e.target.value })}
                      />
                    </div>
                  )}

                  <div>
                    <label className={label}>Save parts of the response onto the contact</label>
                    <textarea
                      className={clsx(input, "mt-1.5 h-20 py-2 font-mono text-[12px] resize-y")}
                      placeholder={'{ "data.status": "loan_status" }'}
                      value={reqForm.saveTo}
                      onChange={(e) => setReqForm({ ...reqForm, saveTo: e.target.value })}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Left side is a path into the response, right side is the contact field to write.
                      A later journey step can then branch on it.
                    </p>
                  </div>
                </section>

                <section className="rounded-xl border bg-card shadow-card p-5 space-y-3">
                  <div className="flex items-end gap-2 flex-wrap">
                    <div className="flex-1 min-w-48">
                      <label className={label}>Try it as</label>
                      <select className={clsx(input, "mt-1.5")} value={runAs} onChange={(e) => setRunAs(e.target.value)}>
                        <option value="">Nobody — leave tokens blank</option>
                        {contacts.map((c) => (
                          <option key={c.id} value={c.id}>{c.name || `+${c.phone}`}</option>
                        ))}
                      </select>
                    </div>
                    <button className={btnGhost} onClick={() => run(true)} disabled={busy !== null}>
                      Dry run
                    </button>
                    <button className={btnPri} onClick={() => run(false)} disabled={busy !== null}>
                      {busy === "run" ? <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" /> : <Play className="w-3.5 h-3.5 inline mr-1.5" />}
                      Send
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    A dry run calls the API but doesn&apos;t write anything back to the contact.
                  </p>
                </section>

                {result && (
                  <section className="rounded-xl border bg-card shadow-card overflow-hidden">
                    <div className="px-5 py-3 border-b bg-muted/30 flex items-center gap-3 flex-wrap">
                      <span className={clsx(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        result.ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                      )}>
                        {result.ok ? <Check className="w-3 h-3 inline mr-1" /> : <X className="w-3 h-3 inline mr-1" />}
                        {result.statusCode ?? "no response"}
                      </span>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />{result.durationMs} ms
                      </span>
                      <code className="text-[11px] text-muted-foreground truncate flex-1">{result.url}</code>
                    </div>

                    {result.error && (
                      <p className="px-5 py-3 text-sm text-destructive border-b">{result.error}</p>
                    )}
                    {result.saved && Object.keys(result.saved).length > 0 && (
                      <div className="px-5 py-3 border-b bg-accent/40">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Written onto the contact
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {Object.entries(result.saved).map(([k, v]) => (
                            <span key={k} className="text-[11px] px-2 py-0.5 rounded bg-background border font-mono">
                              {k} = {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {result.requestBody && (
                      <div className="border-b">
                        <div className="px-5 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Sent
                        </div>
                        <pre className="px-5 pb-3 pt-1 text-[11.5px] font-mono overflow-x-auto text-muted-foreground">
                          {result.requestBody}
                        </pre>
                      </div>
                    )}
                    <div>
                      <div className="px-5 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Response
                      </div>
                      <pre className="px-5 pb-4 pt-1 text-[11.5px] font-mono overflow-x-auto max-h-80 text-muted-foreground">
                        {result.response || "(empty)"}
                      </pre>
                    </div>
                  </section>
                )}

                <div className="flex">
                  <div className="flex-1" />
                  <button className={btnGhost} onClick={saveRequest} disabled={busy !== null}>
                    {busy === "save" && <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />}Save request
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
