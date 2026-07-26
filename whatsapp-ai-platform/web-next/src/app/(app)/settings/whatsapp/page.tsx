"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BadgeCheck, Building2, Check, Copy, Loader2, MessageSquareText, Phone,
  PlugZap, RefreshCw, Settings2, ShieldAlert, Unplug, Webhook, X,
} from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";

interface MetaErrorDetail {
  message: string; type?: string; code?: number; subcode?: number; fbtraceId?: string; hint?: string;
}
interface Step { key: string; label: string; ok: boolean; detail?: string; error?: MetaErrorDetail }

interface BusinessDetails {
  legalName?: string | null; email?: string | null; website?: string | null;
  country?: string | null; timezone?: string | null; vertical?: string | null;
  address?: string | null; description?: string | null;
}
interface Status {
  configured: boolean;
  connected: boolean;
  platformProvided: boolean;
  appId?: string;
  configId?: string;
  setupStep: number;
  business_details?: BusinessDetails;
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
  lastSteps?: Step[] | null;
}
interface NumberRow {
  id: string;
  /** Meta's id — what everything routes on. */
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName?: string | null;
  qualityRating?: string | null;
  codeVerificationStatus?: string | null;
  messagingLimit?: string | null;
  label?: string | null;
  isDefault: boolean;
  active: boolean;
}
interface Profile {
  about?: string; address?: string; description?: string;
  email?: string; websites?: string[]; vertical?: string; profilePictureUrl?: string;
}

/** Meta's business categories, in the order their own picker shows them. */
const VERTICALS = [
  ["OTHER", "Other"], ["AUTO", "Automotive"], ["BEAUTY", "Beauty, spa and salon"],
  ["APPAREL", "Clothing and apparel"], ["EDU", "Education"], ["ENTERTAIN", "Entertainment"],
  ["EVENT_PLAN", "Event planning and service"], ["FINANCE", "Finance and banking"],
  ["GROCERY", "Food and grocery"], ["GOVT", "Public service"], ["HOTEL", "Hotel and lodging"],
  ["HEALTH", "Medical and health"], ["NONPROFIT", "Non-profit"],
  ["PROF_SERVICES", "Professional services"], ["RETAIL", "Shopping and retail"],
  ["TRAVEL", "Travel and transportation"], ["RESTAURANT", "Restaurant"],
] as const;

const input = "w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const label = "text-xs font-medium text-muted-foreground";
const btnPri = "h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-50";

const STEPS = [
  { n: 1, title: "Business details", blurb: "Who the account belongs to" },
  { n: 2, title: "Connect Meta", blurb: "Sign in and pick your business" },
  { n: 3, title: "Phone number", blurb: "Add and verify the number" },
  { n: 4, title: "Public profile", blurb: "What customers see" },
  { n: 5, title: "Finish", blurb: "Go live" },
];

function Field({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className={label}>{title}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

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

function StepTrace({ steps, title }: { steps: Step[]; title: string }) {
  return (
    <section className="rounded-xl border bg-card shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="divide-y">
        {steps.map((s) => (
          <div key={s.key} className="px-5 py-3">
            <div className="flex items-center gap-2.5">
              {s.ok ? <Check className="w-4 h-4 text-success shrink-0" /> : <X className="w-4 h-4 text-destructive shrink-0" />}
              <span className={clsx("text-sm", !s.ok && "text-destructive font-medium")}>{s.label}</span>
            </div>
            {s.detail && <p className="text-xs text-muted-foreground ml-[26px] mt-1">{s.detail}</p>}
            {s.error && <div className="mt-2 ml-6"><ErrorCard err={s.error} /></div>}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function WhatsAppSetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [step, setStep] = useState(1);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [checks, setChecks] = useState<Step[] | null>(null);
  const [numbers, setNumbers] = useState<NumberRow[]>([]);
  const [profile, setProfile] = useState<Profile>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<MetaErrorDetail | null>(null);
  const [showAppForm, setShowAppForm] = useState(false);
  const [appForm, setAppForm] = useState({ appId: "", appSecret: "", configId: "" });
  const [biz, setBiz] = useState<BusinessDetails>({});
  const [otp, setOtp] = useState({ phoneNumberId: "", method: "SMS" as "SMS" | "VOICE", code: "", requested: false });

  const load = useCallback(async () => {
    const r = await api.get<{ status: Status }>("/whatsapp/status");
    setStatus(r.status);
    setBiz((b) => (Object.keys(b).length ? b : r.status.business_details || {}));
    setAppForm((f) => ({ ...f, appId: r.status.appId || "", configId: r.status.configId || "" }));
    setStep((s) => (s > 1 ? s : Math.min(5, Math.max(1, r.status.setupStep + 1))));
    // The trace was written before Meta redirected the browser away.
    if (r.status.lastSteps?.length) setSteps(r.status.lastSteps);
    if (r.status.connected) {
      api.get<{ numbers: NumberRow[] }>("/whatsapp/numbers").then((n) => setNumbers(n.numbers)).catch(() => {});
      api.get<{ profile: Profile | null }>("/whatsapp/profile")
        .then((p) => p.profile && setProfile((prev) => (Object.keys(prev).length ? prev : p.profile!)))
        .catch(() => {});
    }
    return r.status;
  }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);

  // Meta sends the browser back here with ?setup= on the query string.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const outcome = q.get("setup");
    if (!outcome) return;
    if (outcome === "connected") setNote("Connected. Meta sent you back — here's what happened.");
    else if (outcome === "cancelled") setErr({ message: "You came back from Meta without finishing." });
    else if (outcome === "error") setErr({ message: q.get("message") || "The connection failed." });
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  function failure(e: unknown, fallback: string) {
    const body = (e as ApiError & { body?: any })?.body;
    const failed: Step | undefined = body?.steps?.find((s: Step) => !s.ok);
    if (body?.steps) setSteps(body.steps as Step[]);
    setErr(failed?.error || body?.meta || { message: e instanceof Error ? e.message : fallback });
  }

  async function saveBusiness() {
    setBusy("biz"); setErr(null);
    try {
      const r = await api.patch<{ status: Status }>("/whatsapp/business", {
        legalName: biz.legalName || undefined,
        email: biz.email || undefined,
        website: biz.website || undefined,
        country: biz.country || undefined,
        timezone: biz.timezone || undefined,
        vertical: biz.vertical || undefined,
        address: biz.address || undefined,
        description: biz.description || undefined,
      });
      setStatus(r.status);
      setStep(2);
    } catch (e) { failure(e, "Could not save the business details."); }
    finally { setBusy(null); }
  }

  async function saveApp() {
    setBusy("app"); setErr(null);
    try {
      const r = await api.patch<{ status: Status }>("/whatsapp/app", {
        appId: appForm.appId.trim(),
        appSecret: appForm.appSecret.trim() || undefined,
        configId: appForm.configId.trim(),
      });
      setStatus(r.status);
      setShowAppForm(false);
      setAppForm((f) => ({ ...f, appSecret: "" }));
    } catch (e) { failure(e, "Could not save the app details."); }
    finally { setBusy(null); }
  }

  /**
   * Hand the whole browser over to Meta. Everything happens on facebook.com,
   * and Meta returns to our callback, which brings the browser back here.
   */
  async function connect() {
    setBusy("connect"); setErr(null);
    try {
      const r = await api.get<{ url: string }>(
        `/whatsapp/oauth/start?returnTo=${encodeURIComponent(window.location.origin)}`
      );
      window.location.href = r.url;
    } catch (e) {
      failure(e, "Could not start the Meta sign-in.");
      setBusy(null);
    }
  }

  async function requestCode() {
    setBusy("otp"); setErr(null); setNote(null);
    try {
      await api.post("/whatsapp/numbers/request-code", { phoneNumberId: otp.phoneNumberId, method: otp.method });
      setOtp((o) => ({ ...o, requested: true }));
      setNote(otp.method === "SMS" ? "Meta has texted the code to that number." : "Meta is calling that number with the code.");
    } catch (e) { failure(e, "Could not send the code."); }
    finally { setBusy(null); }
  }

  async function submitCode() {
    setBusy("otp"); setErr(null);
    try {
      const r = await api.post<{ status: Status; registerNote?: string }>("/whatsapp/numbers/verify-code", {
        phoneNumberId: otp.phoneNumberId, code: otp.code.trim(),
      });
      setStatus(r.status);
      setNote(r.registerNote ? `Verified. Registration note from Meta: ${r.registerNote}` : "Number verified and registered.");
      await load();
      setStep(4);
    } catch (e) { failure(e, "That code wasn't accepted."); }
    finally { setBusy(null); }
  }

  async function renameNumber(phoneNumberId: string, label: string) {
    setBusy("number"); setErr(null);
    try {
      const r = await api.patch<{ numbers: NumberRow[] }>(`/whatsapp/numbers/${phoneNumberId}`, {
        label: label || null,
      });
      setNumbers(r.numbers);
    } catch (e) { failure(e, "Could not rename that number."); }
    finally { setBusy(null); }
  }

  /** The default is what campaigns and one-off sends use when nothing says otherwise. */
  async function makeDefault(phoneNumberId: string) {
    setBusy("number"); setErr(null);
    try {
      const r = await api.patch<{ numbers: NumberRow[] }>(`/whatsapp/numbers/${phoneNumberId}`, {
        isDefault: true,
      });
      setNumbers(r.numbers);
      await load();
    } catch (e) { failure(e, "Could not change the default."); }
    finally { setBusy(null); }
  }

  async function saveProfile() {
    setBusy("profile"); setErr(null);
    try {
      const r = await api.post<{ status: Status }>("/whatsapp/profile", {
        about: profile.about || undefined,
        description: profile.description || undefined,
        address: profile.address || undefined,
        email: profile.email || undefined,
        websites: profile.websites?.filter(Boolean),
        vertical: profile.vertical || biz.vertical || undefined,
      });
      setStatus(r.status);
      setStep(5);
    } catch (e) { failure(e, "Could not save the profile."); }
    finally { setBusy(null); }
  }

  async function act(kind: "verify" | "repair" | "disconnect") {
    setBusy(kind); setErr(null); setChecks(null);
    try {
      const r = await api.post<{ status: Status; checks?: Step[] }>(`/whatsapp/${kind}`);
      setStatus(r.status);
      if (r.checks) setChecks(r.checks);
      if (kind === "disconnect") { setSteps(null); setNumbers([]); setProfile({}); setStep(2); }
    } catch (e) { failure(e, "That didn't work."); }
    finally { setBusy(null); }
  }

  if (!status) {
    return <div className="flex-1 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  const done = (n: number) => status.setupStep >= n;
  const needsAppDetails = !status.configured && !status.platformProvided;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-16 shrink-0 border-b bg-card/60 flex items-center gap-3 px-6">
        <button onClick={() => router.push("/settings")} className="p-2 -ml-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-base font-semibold">WhatsApp setup</h1>
          <p className="text-xs text-muted-foreground">
            {status.connected
              ? `Connected${status.number?.display ? ` · ${status.number.display}` : ""}`
              : "Sending is simulated until this is finished"}
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

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* step rail */}
        <aside className="w-64 shrink-0 border-r bg-card overflow-y-auto p-3">
          {STEPS.map((s) => {
            const complete = done(s.n);
            const active = step === s.n;
            return (
              <button
                key={s.n}
                onClick={() => setStep(s.n)}
                className={clsx(
                  "w-full text-left flex items-start gap-3 rounded-xl px-3 py-3 mb-1 transition-colors",
                  active ? "bg-accent" : "hover:bg-muted"
                )}
              >
                <span className={clsx(
                  "w-6 h-6 rounded-full grid place-items-center text-[11px] font-semibold shrink-0 mt-0.5",
                  complete ? "bg-success text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {complete ? <Check className="w-3.5 h-3.5" /> : s.n}
                </span>
                <span className="min-w-0">
                  <span className={clsx("block text-[13px] font-medium", active && "text-accent-foreground")}>{s.title}</span>
                  <span className="block text-[11px] text-muted-foreground">{s.blurb}</span>
                </span>
              </button>
            );
          })}

          {status.connected && (
            <button onClick={() => setShowAppForm(true)}
              className="w-full text-left flex items-center gap-2 rounded-lg px-3 h-9 mt-3 text-[13px] text-muted-foreground hover:bg-muted">
              <Settings2 className="w-4 h-4" />Advanced
            </button>
          )}
        </aside>

        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-8 space-y-6">
            {err && <ErrorCard err={err} title="Meta said no" />}
            {!err && status.error && <ErrorCard err={{ message: status.error }} title="Last problem" />}
            {note && <div className="rounded-xl border bg-accent px-4 py-3 text-sm text-accent-foreground">{note}</div>}

            {/* advanced: platform app credentials */}
            {(showAppForm || (step === 2 && needsAppDetails)) && (
              <section className="rounded-xl border bg-card shadow-card p-6 space-y-5">
                <div>
                  <h2 className="text-sm font-semibold">Meta app</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {status.platformProvided
                      ? "The platform already supplies an app — override it only if this workspace has its own."
                      : "Entered once for the whole workspace. Nobody has to touch it again."}
                  </p>
                </div>
                <div className="grid gap-4">
                  <Field title="App ID">
                    <input className={input} value={appForm.appId} placeholder="1234567890123456"
                      onChange={(e) => setAppForm({ ...appForm, appId: e.target.value })} />
                  </Field>
                  <Field title="App secret" hint="Stored server-side and never sent back to the browser.">
                    <input className={input} type="password" value={appForm.appSecret}
                      placeholder={status.configured ? "•••••••• (leave blank to keep)" : ""}
                      onChange={(e) => setAppForm({ ...appForm, appSecret: e.target.value })} />
                  </Field>
                  <Field title="Login configuration ID">
                    <input className={input} value={appForm.configId} placeholder="From Facebook Login for Business"
                      onChange={(e) => setAppForm({ ...appForm, configId: e.target.value })} />
                  </Field>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <p className="text-xs font-medium">Set these in the Meta app once, under WhatsApp → Configuration:</p>
                  <CopyRow title="Callback URL" value={status.webhookUrl} />
                  {status.verifyToken && <CopyRow title="Verify token" value={status.verifyToken} />}
                  <p className="text-[11px] text-muted-foreground">
                    The callback URL must be reachable from the internet — a localhost address never receives anything.
                  </p>
                </div>
                <div className="flex gap-2">
                  {status.configured && <button className={btnGhost} onClick={() => setShowAppForm(false)}>Cancel</button>}
                  <div className="flex-1" />
                  <button className={btnPri} onClick={saveApp}
                    disabled={busy !== null || !appForm.appId.trim() || !appForm.configId.trim() || (!status.configured && !appForm.appSecret.trim())}>
                    {busy === "app" && <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />}Save
                  </button>
                </div>
              </section>
            )}

            {/* 1 — business details */}
            {step === 1 && (
              <section className="rounded-xl border bg-card shadow-card p-6 space-y-5">
                <div>
                  <h2 className="text-sm font-semibold">Tell us about the business</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Meta asks for these during review, and they pre-fill the profile customers see. Nothing here is sent
                    anywhere until you connect.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field title="Legal business name" hint="Exactly as registered — Meta checks this against your documents.">
                      <input className={input} value={biz.legalName || ""} placeholder="Demo Realty Pvt Ltd"
                        onChange={(e) => setBiz({ ...biz, legalName: e.target.value })} />
                    </Field>
                  </div>
                  <Field title="Business category">
                    <select className={input} value={biz.vertical || ""} onChange={(e) => setBiz({ ...biz, vertical: e.target.value })}>
                      <option value="">Choose one</option>
                      {VERTICALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </Field>
                  <Field title="Country">
                    <input className={input} value={biz.country || ""} placeholder="India"
                      onChange={(e) => setBiz({ ...biz, country: e.target.value })} />
                  </Field>
                  <Field title="Business email">
                    <input className={input} value={biz.email || ""} placeholder="hello@demorealty.in"
                      onChange={(e) => setBiz({ ...biz, email: e.target.value })} />
                  </Field>
                  <Field title="Website">
                    <input className={input} value={biz.website || ""} placeholder="https://demorealty.in"
                      onChange={(e) => setBiz({ ...biz, website: e.target.value })} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field title="Business address">
                      <input className={input} value={biz.address || ""} placeholder="12 MG Road, Bengaluru 560001"
                        onChange={(e) => setBiz({ ...biz, address: e.target.value })} />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field title="What the business does" hint="Shown on your WhatsApp profile.">
                      <textarea className={clsx(input, "h-20 py-2 resize-none")} value={biz.description || ""}
                        onChange={(e) => setBiz({ ...biz, description: e.target.value })} />
                    </Field>
                  </div>
                </div>
                <div className="flex">
                  <div className="flex-1" />
                  <button className={btnPri} onClick={saveBusiness} disabled={busy !== null || !biz.legalName?.trim()}>
                    {busy === "biz" && <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />}Save and continue
                  </button>
                </div>
              </section>
            )}

            {/* 2 — connect */}
            {step === 2 && !needsAppDetails && (
              <section className="rounded-2xl border bg-card shadow-card p-8 text-center">
                <PlugZap className="w-9 h-9 mx-auto text-primary" />
                <h2 className="text-lg font-semibold mt-4">
                  {status.connected ? "Meta account connected" : "Sign in to Meta"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
                  {status.connected
                    ? `${status.business?.name || "Your business"}${status.waba?.name ? ` · ${status.waba.name}` : ""}`
                    : "Meta's own window handles the login, the business portfolio and creating the WhatsApp account. Nothing is copied by hand."}
                </p>
                {!status.connected && (
                  <ul className="text-xs text-muted-foreground mt-5 space-y-1.5 inline-block text-left">
                    {["Sign in with Facebook", "Pick or create your business portfolio",
                      "Pick or create the WhatsApp Business Account", "Add the phone number you'll message from"].map((s) => (
                      <li key={s} className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-success" />{s}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button className={clsx(btnPri, "h-11 px-6 text-[15px]")} onClick={connect} disabled={busy !== null}>
                    {busy === "connect" && <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />}
                    {busy === "connect" ? "Taking you to Meta…" : status.connected ? "Reconnect" : "Continue with Facebook"}
                  </button>
                  {status.connected && <button className={btnGhost} onClick={() => setStep(3)}>Next</button>}
                </div>
              </section>
            )}

            {steps && step <= 3 && <StepTrace steps={steps} title="What happened when you came back" />}

            {/* 3 — number */}
            {step === 3 && (
              status.connected ? (
                <>
                  <section className="rounded-xl border bg-card shadow-card overflow-hidden">
                    <div className="px-5 py-3 border-b bg-muted/30 flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Numbers on this account
                      </span>
                    </div>
                    <div className="divide-y">
                      {numbers.map((n) => {
                        const verified = (n.codeVerificationStatus || "").toUpperCase() === "VERIFIED";
                        return (
                          <div key={n.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium flex items-center gap-2">
                                {n.label || n.displayPhoneNumber}
                                <button
                                  className="text-[11px] text-muted-foreground hover:text-primary underline underline-offset-2"
                                  onClick={() => {
                                    const v = prompt("Name this number — the team sees it in the inbox:", n.label || "");
                                    if (v !== null) void renameNumber(n.phoneNumberId, v.trim());
                                  }}
                                >
                                  rename
                                </button>
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {n.displayPhoneNumber}{n.verifiedName ? ` · ${n.verifiedName}` : ""}
                              </div>
                            </div>
                            <Pill tone={verified ? "good" : "warn"}>{verified ? "verified" : "needs verifying"}</Pill>
                            <Pill tone={qualityTone(n.qualityRating)}>{n.qualityRating?.toLowerCase() || "no rating"}</Pill>
                            {n.isDefault
                              ? <Pill tone="good">default</Pill>
                              : (
                                <button className={btnGhost} disabled={busy !== null}
                                  onClick={() => makeDefault(n.phoneNumberId)}>
                                  Make default
                                </button>
                              )}
                            {!verified && (
                              <button className={btnGhost} disabled={busy !== null}
                                onClick={() => { setOtp({ phoneNumberId: n.phoneNumberId, method: "SMS", code: "", requested: false }); setNote(null); }}>
                                Verify
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {numbers.length === 0 && (
                        <p className="px-5 py-6 text-sm text-muted-foreground">
                          No numbers on this account yet — run the Meta window again and add one.
                        </p>
                      )}
                    </div>
                  </section>

                  {otp.phoneNumberId && (
                    <section className="rounded-xl border bg-card shadow-card p-6 space-y-4">
                      <div>
                        <h2 className="text-sm font-semibold">Verify the number</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Meta sends a six-digit code to the number itself.
                        </p>
                      </div>
                      {!otp.requested ? (
                        <div className="flex items-end gap-2">
                          <div className="w-48">
                            <Field title="How should it arrive?">
                              <select className={input} value={otp.method}
                                onChange={(e) => setOtp({ ...otp, method: e.target.value as "SMS" | "VOICE" })}>
                                <option value="SMS">Text message</option>
                                <option value="VOICE">Phone call</option>
                              </select>
                            </Field>
                          </div>
                          <button className={btnPri} onClick={requestCode} disabled={busy !== null}>
                            {busy === "otp" && <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />}Send the code
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-end gap-2">
                          <div className="w-44">
                            <Field title="Six-digit code">
                              <input className={input} value={otp.code} placeholder="123456" inputMode="numeric"
                                onChange={(e) => setOtp({ ...otp, code: e.target.value })} />
                            </Field>
                          </div>
                          <button className={btnPri} onClick={submitCode} disabled={busy !== null || otp.code.replace(/\D/g, "").length !== 6}>
                            {busy === "otp" && <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />}Verify
                          </button>
                          <button className={btnGhost} onClick={() => setOtp({ ...otp, requested: false, code: "" })}>Send again</button>
                        </div>
                      )}
                    </section>
                  )}

                  <div className="flex">
                    <button className={btnGhost} onClick={() => setStep(2)}>Back</button>
                    <div className="flex-1" />
                    <button className={btnPri} onClick={() => setStep(4)} disabled={numbers.length === 0}>Continue</button>
                  </div>
                </>
              ) : (
                <section className="rounded-xl border border-dashed p-10 text-center">
                  <Phone className="w-6 h-6 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium mt-3">Connect Meta first</p>
                  <p className="text-xs text-muted-foreground mt-1">Numbers come from the account you sign in to.</p>
                  <button className={clsx(btnPri, "mt-4")} onClick={() => setStep(2)}>Go to step 2</button>
                </section>
              )
            )}

            {/* 4 — public profile */}
            {step === 4 && (
              status.connected ? (
                <section className="rounded-xl border bg-card shadow-card p-6 space-y-5">
                  <div>
                    <h2 className="text-sm font-semibold">What customers see</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      This is your WhatsApp profile — the display name itself is set during Meta&apos;s review and
                      shows as <span className="font-medium">{status.number?.verifiedName || "pending"}</span>.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Field title="About line" hint="Up to 139 characters, shown under the name.">
                        <input className={input} maxLength={139} value={profile.about || ""}
                          placeholder="Helping you find your next home"
                          onChange={(e) => setProfile({ ...profile, about: e.target.value })} />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <Field title="Description">
                        <textarea className={clsx(input, "h-20 py-2 resize-none")} maxLength={512}
                          value={profile.description ?? biz.description ?? ""}
                          onChange={(e) => setProfile({ ...profile, description: e.target.value })} />
                      </Field>
                    </div>
                    <Field title="Email">
                      <input className={input} value={profile.email ?? biz.email ?? ""}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                    </Field>
                    <Field title="Website">
                      <input className={input} value={profile.websites?.[0] ?? biz.website ?? ""}
                        onChange={(e) => setProfile({ ...profile, websites: [e.target.value] })} />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field title="Address">
                        <input className={input} value={profile.address ?? biz.address ?? ""}
                          onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
                      </Field>
                    </div>
                    <Field title="Category">
                      <select className={input} value={profile.vertical ?? biz.vertical ?? ""}
                        onChange={(e) => setProfile({ ...profile, vertical: e.target.value })}>
                        <option value="">Choose one</option>
                        {VERTICALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="flex">
                    <button className={btnGhost} onClick={() => setStep(3)}>Back</button>
                    <div className="flex-1" />
                    <button className={btnPri} onClick={saveProfile} disabled={busy !== null}>
                      {busy === "profile" && <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />}Save profile
                    </button>
                  </div>
                </section>
              ) : (
                <section className="rounded-xl border border-dashed p-10 text-center">
                  <MessageSquareText className="w-6 h-6 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium mt-3">Connect a number first</p>
                  <button className={clsx(btnPri, "mt-4")} onClick={() => setStep(2)}>Go to step 2</button>
                </section>
              )
            )}

            {/* 5 — finish */}
            {step === 5 && (
              <>
                {status.connected ? (
                  <div className="rounded-2xl border bg-card shadow-card p-8 text-center">
                    <BadgeCheck className="w-10 h-10 mx-auto text-success" />
                    <h2 className="text-lg font-semibold mt-4">You&apos;re live on WhatsApp</h2>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      {status.number?.display} is sending, and replies land in the inbox.
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <button className={btnGhost} onClick={() => router.push("/templates")}>Submit a template</button>
                      <button className={btnPri} onClick={() => router.push("/inbox")}>Open the inbox</button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-10 text-center">
                    <p className="text-sm font-medium">Not connected yet</p>
                    <button className={clsx(btnPri, "mt-4")} onClick={() => setStep(2)}>Go to step 2</button>
                  </div>
                )}

                {status.connected && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border bg-card shadow-card p-5">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="w-4 h-4" /><span className="text-xs font-semibold uppercase tracking-wide">Business portfolio</span>
                      </div>
                      <div className="text-[15px] font-semibold mt-2">{status.business?.name || "—"}</div>
                      <div className="mt-2">
                        {status.business?.verification === "verified"
                          ? <Pill tone="good">verified</Pill>
                          : <Pill tone="warn">{status.business?.verification || "not verified"}</Pill>}
                      </div>
                    </div>
                    <div className="rounded-xl border bg-card shadow-card p-5">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <BadgeCheck className="w-4 h-4" /><span className="text-xs font-semibold uppercase tracking-wide">WhatsApp account</span>
                      </div>
                      <div className="text-[15px] font-semibold mt-2">{status.waba?.name || "—"}</div>
                      <div className="mt-2">
                        <Pill tone={status.waba?.reviewStatus === "APPROVED" ? "good" : "warn"}>
                          review {status.waba?.reviewStatus?.toLowerCase() || "unknown"}
                        </Pill>
                      </div>
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
                      <div className="text-[15px] font-semibold mt-2">{status.webhookSubscribed ? "Webhook active" : "Not subscribed"}</div>
                      <div className="mt-2">
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
                )}

                {checks && <StepTrace steps={checks} title="Live check" />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
