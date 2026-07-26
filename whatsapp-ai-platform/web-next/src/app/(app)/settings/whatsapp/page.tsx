"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BadgeCheck, Building2, Check, Copy, Loader2, Phone, PlugZap,
  RefreshCw, ShieldAlert, Unplug, Webhook, X,
} from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";

interface MetaErrorDetail {
  message: string;
  type?: string;
  code?: number;
  subcode?: number;
  fbtraceId?: string;
  hint?: string;
}
interface Step { key: string; label: string; ok: boolean; detail?: string; error?: MetaErrorDetail }

interface Status {
  configured: boolean;
  connected: boolean;
  appId?: string;
  configId?: string;
  business?: { id?: string | null; name?: string | null; verification?: string | null };
  waba?: { id?: string | null; name?: string | null; reviewStatus?: string | null };
  number?: {
    id?: string | null; display?: string | null; verifiedName?: string | null;
    quality?: string | null; messagingLimit?: string | null;
  };
  webhookSubscribed: boolean;
  webhookUrl: string;
  verifyToken?: string | null;
  connectedAt?: string | null;
  error?: string | null;
}
interface NumberRow {
  id: string; displayPhoneNumber: string; verifiedName?: string;
  qualityRating?: string; status?: string; codeVerificationStatus?: string; messagingLimit?: string;
}

declare global {
  interface Window {
    FB?: { init: (o: Record<string, unknown>) => void; login: (cb: (r: any) => void, o: Record<string, unknown>) => void };
    fbAsyncInit?: () => void;
  }
}

const input = "w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const label = "text-xs font-medium text-muted-foreground";
const btnPri = "h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-50";

function CopyRow({ title, value }: { title: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div>
      <div className={label}>{title}</div>
      <div className="mt-1.5 flex items-center gap-2">
        <code className="flex-1 text-xs bg-muted/50 border rounded-lg px-3 py-2 break-all">{value}</code>
        <button className={btnGhost} onClick={() => { navigator.clipboard?.writeText(value); setDone(true); setTimeout(() => setDone(false), 1400); }}>
          {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function Pill({ tone, children }: { tone: "good" | "warn" | "bad" | "muted"; children: React.ReactNode }) {
  return (
    <span className={clsx(
      "text-[11px] px-2 py-0.5 rounded-full font-medium",
      tone === "good" && "bg-success/15 text-success",
      tone === "warn" && "bg-warning/15 text-warning",
      tone === "bad" && "bg-destructive/15 text-destructive",
      tone === "muted" && "bg-muted text-muted-foreground",
    )}>{children}</span>
  );
}

const qualityTone = (q?: string | null) =>
  q === "GREEN" ? "good" : q === "YELLOW" ? "warn" : q === "RED" ? "bad" : "muted";

function ErrorCard({ err, title }: { err: MetaErrorDetail; title?: string }) {
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
        <div className="min-w-0">
          {title && <div className="text-sm font-semibold text-destructive">{title}</div>}
          <p className="text-sm text-destructive mt-0.5">{err.message}</p>
          {err.hint && <p className="text-xs text-destructive/90 mt-2">{err.hint}</p>}
          {(err.code || err.fbtraceId) && (
            <p className="text-[11px] text-destructive/70 mt-2 font-mono break-all">
              {err.type && `${err.type} · `}
              {err.code !== undefined && `code ${err.code}`}
              {err.subcode !== undefined && ` / ${err.subcode}`}
              {err.fbtraceId && ` · trace ${err.fbtraceId}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WhatsAppConnectionPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [checks, setChecks] = useState<Step[] | null>(null);
  const [numbers, setNumbers] = useState<NumberRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<MetaErrorDetail | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [form, setForm] = useState({ appId: "", appSecret: "", configId: "" });
  const [editingApp, setEditingApp] = useState(false);
  const signupInfo = useRef<{ wabaId?: string; phoneNumberId?: string }>({});

  const load = useCallback(async () => {
    const r = await api.get<{ status: Status }>("/whatsapp/status");
    setStatus(r.status);
    setForm((f) => ({ ...f, appId: r.status.appId || "", configId: r.status.configId || "" }));
    if (r.status.connected) {
      api.get<{ numbers: NumberRow[] }>("/whatsapp/numbers").then((n) => setNumbers(n.numbers)).catch(() => {});
    }
  }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);

  // Meta's popup posts the ids it picked back to the opener — the code alone
  // doesn't say which number the user chose.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!/facebook\.com$/.test(new URL(e.origin).hostname)) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data?.data) {
          signupInfo.current = {
            wabaId: data.data.waba_id,
            phoneNumberId: data.data.phone_number_id,
          };
        }
      } catch { /* not our message */ }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Load Facebook's SDK only once we know which app id to init it with.
  useEffect(() => {
    if (!status?.appId || sdkReady) return;
    const existing = document.getElementById("facebook-jssdk");
    const init = () => {
      window.FB?.init({ appId: status.appId, cookie: true, xfbml: false, version: "v21.0" });
      setSdkReady(true);
    };
    if (existing && window.FB) { init(); return; }
    window.fbAsyncInit = init;
    if (!existing) {
      const s = document.createElement("script");
      s.id = "facebook-jssdk";
      s.src = "https://connect.facebook.net/en_US/sdk.js";
      s.async = true;
      s.defer = true;
      s.crossOrigin = "anonymous";
      s.onerror = () => setErr({
        message: "Couldn't load Facebook's SDK.",
        hint: "A network block or an ad blocker usually causes this — allow connect.facebook.net and reload.",
      });
      document.body.appendChild(s);
    }
  }, [status?.appId, sdkReady]);

  async function saveApp() {
    setBusy("app"); setErr(null);
    try {
      const r = await api.patch<{ status: Status }>("/whatsapp/app", {
        appId: form.appId.trim(),
        appSecret: form.appSecret.trim() || undefined,
        configId: form.configId.trim(),
      });
      setStatus(r.status);
      setEditingApp(false);
      setForm((f) => ({ ...f, appSecret: "" }));
    } catch (e) {
      setErr({ message: e instanceof Error ? e.message : "Could not save the app details." });
    } finally { setBusy(null); }
  }

  function connect() {
    if (!window.FB || !status?.configId) return;
    setErr(null); setSteps(null); signupInfo.current = {};
    window.FB.login(
      (response: any) => {
        const code = response?.authResponse?.code;
        if (!code) {
          setErr({
            message: "The Meta window closed before finishing.",
            hint: "Run Connect again and complete every step, including choosing a phone number.",
          });
          return;
        }
        void finishConnect(code);
      },
      {
        config_id: status.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      }
    );
  }

  async function finishConnect(code: string) {
    setBusy("connect"); setErr(null);
    try {
      const r = await api.post<{ status: Status; steps: Step[] }>("/whatsapp/connect", {
        code,
        wabaId: signupInfo.current.wabaId,
        phoneNumberId: signupInfo.current.phoneNumberId,
      });
      setSteps(r.steps);
      setStatus(r.status);
      load().catch(() => {});
    } catch (e) {
      const body = (e as ApiError & { body?: any })?.body;
      const failed: Step | undefined = body?.steps?.find((s: Step) => !s.ok);
      if (body?.steps) setSteps(body.steps as Step[]);
      // The failing step carries Meta's own detail — prefer it over the summary.
      setErr(failed?.error || body?.meta || { message: e instanceof Error ? e.message : "The connection failed." });
    } finally { setBusy(null); }
  }

  async function act(kind: "verify" | "repair" | "disconnect") {
    setBusy(kind); setErr(null); setChecks(null);
    try {
      const r = await api.post<{ status: Status; checks?: Step[] }>(`/whatsapp/${kind}`);
      setStatus(r.status);
      if (r.checks) setChecks(r.checks);
      if (kind === "disconnect") { setSteps(null); setNumbers([]); }
    } catch (e) {
      const body = (e as ApiError & { body?: any })?.body;
      setErr(body?.meta || { message: e instanceof Error ? e.message : "That didn't work." });
    } finally { setBusy(null); }
  }

  async function selectNumber(id: string) {
    setBusy("number"); setErr(null);
    try {
      const r = await api.post<{ status: Status; registerNote?: string }>("/whatsapp/numbers/select", { phoneNumberId: id });
      setStatus(r.status);
    } catch (e) {
      const body = (e as ApiError & { body?: any })?.body;
      setErr(body?.meta || { message: e instanceof Error ? e.message : "Could not switch number." });
    } finally { setBusy(null); }
  }

  if (!status) {
    return <div className="flex-1 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  const showAppForm = !status.configured || editingApp;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-16 shrink-0 border-b bg-card/60 flex items-center gap-3 px-6">
        <button onClick={() => router.push("/settings")} className="p-2 -ml-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-base font-semibold">WhatsApp connection</h1>
          <p className="text-xs text-muted-foreground">
            {status.connected
              ? `Connected${status.number?.display ? ` · ${status.number.display}` : ""}`
              : "Not connected — campaigns and replies are simulated until you connect"}
          </p>
        </div>
        <div className="flex-1" />
        {status.connected && (
          <>
            <button className={btnGhost} disabled={busy !== null} onClick={() => act("verify")}>
              {busy === "verify" ? <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 inline mr-1.5" />}
              Re-check
            </button>
            <button className={btnGhost} disabled={busy !== null}
              onClick={() => confirm("Disconnect this WhatsApp account? Sending stops until you reconnect.") && act("disconnect")}>
              <Unplug className="w-3.5 h-3.5 inline mr-1.5" />Disconnect
            </button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8 space-y-6">
          {err && <ErrorCard err={err} title="Meta said no" />}
          {status.error && !err && <ErrorCard err={{ message: status.error }} title="Last connection problem" />}

          {/* ---- one-time app details ---- */}
          {showAppForm && (
            <section className="rounded-xl border bg-card shadow-card p-6 space-y-5">
              <div>
                <h2 className="text-sm font-semibold">Your Meta app</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Filled in once. After this, connecting an account is a single button — no tokens to copy.
                </p>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className={label}>App ID</label>
                  <input className={clsx(input, "mt-1.5")} value={form.appId} placeholder="1234567890123456"
                    onChange={(e) => setForm({ ...form, appId: e.target.value })} />
                </div>
                <div>
                  <label className={label}>App secret</label>
                  <input className={clsx(input, "mt-1.5")} type="password"
                    placeholder={status.configured ? "•••••••• (leave blank to keep)" : ""}
                    value={form.appSecret} onChange={(e) => setForm({ ...form, appSecret: e.target.value })} />
                  <p className="text-[11px] text-muted-foreground mt-1">Stored server-side and never sent back to the browser.</p>
                </div>
                <div>
                  <label className={label}>Login configuration ID</label>
                  <input className={clsx(input, "mt-1.5")} value={form.configId} placeholder="From Facebook Login for Business"
                    onChange={(e) => setForm({ ...form, configId: e.target.value })} />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-medium">Paste these into your Meta app once, under WhatsApp → Configuration:</p>
                <CopyRow title="Callback URL" value={status.webhookUrl} />
                {status.verifyToken
                  ? <CopyRow title="Verify token" value={status.verifyToken} />
                  : <p className="text-[11px] text-muted-foreground">A verify token is generated for you when you save.</p>}
                <p className="text-[11px] text-muted-foreground">
                  The callback URL has to be reachable from the internet — a localhost address won&apos;t receive anything.
                </p>
              </div>

              <div className="flex gap-2">
                {status.configured && <button className={btnGhost} onClick={() => setEditingApp(false)}>Cancel</button>}
                <div className="flex-1" />
                <button className={btnPri} onClick={saveApp}
                  disabled={busy !== null || !form.appId.trim() || !form.configId.trim() || (!status.configured && !form.appSecret.trim())}>
                  {busy === "app" && <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />}Save app details
                </button>
              </div>
            </section>
          )}

          {/* ---- connect ---- */}
          {status.configured && !status.connected && !showAppForm && (
            <section className="rounded-2xl border bg-card shadow-card p-8 text-center">
              <PlugZap className="w-9 h-9 mx-auto text-primary" />
              <h2 className="text-lg font-semibold mt-4">Connect your WhatsApp account</h2>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
                Meta&apos;s own window handles the login, the business selection and the number verification.
                Everything after that happens here automatically.
              </p>
              <ul className="text-xs text-muted-foreground mt-5 space-y-1.5 inline-block text-left">
                {[
                  "Exchange the login for an access token",
                  "Find your WhatsApp Business Account",
                  "Subscribe this server to your webhooks",
                  "Register your number for sending",
                ].map((s) => (
                  <li key={s} className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-success" />{s}</li>
                ))}
              </ul>
              <div className="mt-6 flex items-center justify-center gap-2">
                <button className={clsx(btnPri, "h-11 px-6 text-[15px]")} onClick={connect} disabled={!sdkReady || busy !== null}>
                  {busy === "connect" ? <Loader2 className="w-4 h-4 inline mr-2 animate-spin" /> : null}
                  {busy === "connect" ? "Connecting…" : sdkReady ? "Connect with Facebook" : "Loading Meta…"}
                </button>
                <button className={btnGhost} onClick={() => setEditingApp(true)}>App details</button>
              </div>
            </section>
          )}

          {/* ---- step trace ---- */}
          {steps && (
            <section className="rounded-xl border bg-card shadow-card overflow-hidden">
              <div className="px-5 py-3 border-b bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                What happened
              </div>
              <div className="divide-y">
                {steps.map((s) => (
                  <div key={s.key} className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      {s.ok
                        ? <Check className="w-4 h-4 text-success shrink-0" />
                        : <X className="w-4 h-4 text-destructive shrink-0" />}
                      <span className={clsx("text-sm", !s.ok && "text-destructive font-medium")}>{s.label}</span>
                    </div>
                    {s.detail && <p className="text-xs text-muted-foreground ml-[26px] mt-1">{s.detail}</p>}
                    {s.error && <div className="mt-2 ml-6"><ErrorCard err={s.error} /></div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---- connected dashboard ---- */}
          {status.connected && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border bg-card shadow-card p-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="w-4 h-4" /><span className="text-xs font-semibold uppercase tracking-wide">Business portfolio</span>
                  </div>
                  <div className="text-[15px] font-semibold mt-2">{status.business?.name || "—"}</div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {status.business?.verification === "verified"
                      ? <Pill tone="good">verified</Pill>
                      : <Pill tone="warn">{status.business?.verification || "not verified"}</Pill>}
                  </div>
                  {status.business?.id && <div className="text-[11px] text-muted-foreground mt-2 font-mono">{status.business.id}</div>}
                </div>

                <div className="rounded-xl border bg-card shadow-card p-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <BadgeCheck className="w-4 h-4" /><span className="text-xs font-semibold uppercase tracking-wide">WhatsApp account</span>
                  </div>
                  <div className="text-[15px] font-semibold mt-2">{status.waba?.name || "—"}</div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Pill tone={status.waba?.reviewStatus === "APPROVED" ? "good" : "warn"}>
                      review {status.waba?.reviewStatus?.toLowerCase() || "unknown"}
                    </Pill>
                  </div>
                  {status.waba?.id && <div className="text-[11px] text-muted-foreground mt-2 font-mono">{status.waba.id}</div>}
                </div>

                <div className="rounded-xl border bg-card shadow-card p-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" /><span className="text-xs font-semibold uppercase tracking-wide">Sending number</span>
                  </div>
                  <div className="text-[15px] font-semibold mt-2">{status.number?.display || "—"}</div>
                  <div className="text-xs text-muted-foreground">{status.number?.verifiedName}</div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <Pill tone={qualityTone(status.number?.quality)}>quality {status.number?.quality?.toLowerCase() || "n/a"}</Pill>
                    {status.number?.messagingLimit && <Pill tone="muted">{status.number.messagingLimit.replace("TIER_", "")} / day</Pill>}
                  </div>
                </div>

                <div className="rounded-xl border bg-card shadow-card p-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Webhook className="w-4 h-4" /><span className="text-xs font-semibold uppercase tracking-wide">Incoming messages</span>
                  </div>
                  <div className="text-[15px] font-semibold mt-2">
                    {status.webhookSubscribed ? "Webhook active" : "Not subscribed"}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {status.webhookSubscribed
                      ? <Pill tone="good">receiving</Pill>
                      : (
                        <button className="h-7 px-3 rounded-lg bg-destructive text-white text-xs font-medium disabled:opacity-50"
                          disabled={busy !== null} onClick={() => act("repair")}>
                          {busy === "repair" && <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />}Repair
                        </button>
                      )}
                  </div>
                </div>
              </div>

              {checks && (
                <section className="rounded-xl border bg-card shadow-card overflow-hidden">
                  <div className="px-5 py-3 border-b bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Live check
                  </div>
                  <div className="divide-y">
                    {checks.map((c) => (
                      <div key={c.key} className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          {c.ok ? <Check className="w-4 h-4 text-success shrink-0" /> : <X className="w-4 h-4 text-destructive shrink-0" />}
                          <span className="text-sm">{c.label}</span>
                        </div>
                        {c.detail && <p className="text-xs text-muted-foreground ml-[26px] mt-1">{c.detail}</p>}
                        {c.error && <div className="mt-2 ml-6"><ErrorCard err={c.error} /></div>}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {numbers.length > 1 && (
                <section className="rounded-xl border bg-card shadow-card overflow-hidden">
                  <div className="px-5 py-3 border-b bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Numbers on this account
                  </div>
                  <div className="divide-y">
                    {numbers.map((n) => (
                      <div key={n.id} className="px-5 py-3 flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{n.displayPhoneNumber}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {n.verifiedName || "unnamed"} · {n.codeVerificationStatus || "unverified"}
                          </div>
                        </div>
                        <Pill tone={qualityTone(n.qualityRating)}>{n.qualityRating?.toLowerCase() || "n/a"}</Pill>
                        {n.id === status.number?.id
                          ? <Pill tone="good">sending</Pill>
                          : <button className={btnGhost} disabled={busy !== null} onClick={() => selectNumber(n.id)}>Use this</button>}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div className="rounded-xl border bg-card shadow-card p-5 space-y-3">
                <h3 className="text-sm font-semibold">Webhook details</h3>
                <CopyRow title="Callback URL" value={status.webhookUrl} />
                {status.verifyToken && <CopyRow title="Verify token" value={status.verifyToken} />}
                <button className={btnGhost} onClick={() => setEditingApp(true)}>Change app details</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
