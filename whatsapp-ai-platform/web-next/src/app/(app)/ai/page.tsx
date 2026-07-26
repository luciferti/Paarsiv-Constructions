"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, BrainCircuit, PowerOff, Sparkles, Zap } from "lucide-react";
import clsx from "clsx";
import { api, getSession } from "@/lib/api";
import type { TenantSettings, Usage } from "@/lib/types";

const inputCls = "w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const btnPri = "h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50";

const ENGINES = [
  { key: "OWN", title: "Own (rules)", desc: "Keyword bot — zero LLM cost", icon: Zap },
  { key: "CLAUDE", title: "Claude", desc: "Anthropic — smart replies", icon: Sparkles },
  { key: "GPT", title: "GPT", desc: "OpenAI GPT-4o-mini", icon: BrainCircuit },
  { key: "OFF", title: "Off", desc: "No auto-reply; humans only", icon: PowerOff },
] as const;

export default function AiControlPage() {
  const session = typeof window !== "undefined" ? getSession() : null;
  const isAdmin = session?.user.role === "ADMIN";
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [botName, setBotName] = useState("");
  const [claudeKey, setClaudeKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    api.get<{ tenant: TenantSettings; usage: Usage }>("/settings")
      .then((r) => { setSettings(r.tenant); setUsage(r.usage); setBotName(r.tenant.botName); })
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function patch(body: Record<string, unknown>) {
    if (!isAdmin) return;
    const r = await api.patch<{ tenant: TenantSettings }>("/settings", body);
    setSettings(r.tenant);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  if (!settings) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 border-b bg-card/50">
        <h1 className="text-xl font-semibold">AI Control</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Pick the engine that answers customers — only one is active at a time</p>
      </div>

      <div className="p-8 space-y-6 max-w-4xl">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="text-[13px] text-muted-foreground">AI replies today</div>
            <div className="mt-1 text-3xl font-semibold">{usage?.aiToday ?? 0}</div>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="text-[13px] text-muted-foreground">Agent replies today</div>
            <div className="mt-1 text-3xl font-semibold">{usage?.agentToday ?? 0}</div>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <div className="text-[13px] text-muted-foreground">Open conversations</div>
            <div className="mt-1 text-3xl font-semibold">{usage?.openConvs ?? 0}</div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Bot className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-[15px] font-semibold">Engine</h2>
            {saved && <span className="text-xs text-primary font-medium ml-2">Saved ✓</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {ENGINES.map((e) => {
              const Icon = e.icon;
              const sel = settings.aiSource === e.key;
              return (
                <button
                  key={e.key}
                  disabled={!isAdmin}
                  onClick={() => patch({ aiSource: e.key })}
                  className={clsx(
                    "text-left rounded-xl border-2 p-4 transition-colors",
                    sel ? "border-primary bg-accent" : "hover:bg-muted/60"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={clsx("w-4 h-4", sel ? "text-primary" : "text-muted-foreground")} />
                    <span className={clsx("font-semibold text-sm", sel && "text-accent-foreground")}>{e.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{e.desc}</p>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-5 pt-4 border-t">
            <span className="text-sm">Master AI switch</span>
            <button
              disabled={!isAdmin}
              onClick={() => patch({ aiEnabled: !settings.aiEnabled })}
              className={clsx(
                "h-8 px-4 rounded-lg text-xs font-medium",
                settings.aiEnabled ? "bg-primary text-primary-foreground" : "border text-muted-foreground"
              )}
            >
              {settings.aiEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>
        </div>

        {isAdmin && (
          <div className="rounded-xl border bg-card p-6 shadow-card space-y-3">
            <h2 className="text-[15px] font-semibold">Configuration</h2>
            <p className="text-xs text-muted-foreground">Keys are stored masked and never returned to the browser.</p>
            <div>
              <label className="text-xs text-muted-foreground">Bot name</label>
              <input className={clsx(inputCls, "mt-1")} value={botName} onChange={(e) => setBotName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Claude API key {settings.claudeKey ? "(set)" : "(not set)"}</label>
              <input type="password" className={clsx(inputCls, "mt-1")} placeholder="sk-ant-…" value={claudeKey} onChange={(e) => setClaudeKey(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">OpenAI API key {settings.openaiKey ? "(set)" : "(not set)"}</label>
              <input type="password" className={clsx(inputCls, "mt-1")} placeholder="sk-…" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} />
            </div>
            <button
              className={btnPri}
              onClick={() => {
                const body: Record<string, unknown> = {};
                if (botName) body.botName = botName;
                if (claudeKey.trim()) body.claudeKey = claudeKey.trim();
                if (openaiKey.trim()) body.openaiKey = openaiKey.trim();
                patch(body).then(() => { setClaudeKey(""); setOpenaiKey(""); });
              }}
            >
              Save configuration
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
