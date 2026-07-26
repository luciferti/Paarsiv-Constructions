import { useEffect, useState } from "react";
import { api } from "../api";
import type { AiSource, TenantSettings, Usage, User } from "../types";

const ENGINES: { key: AiSource; title: string; desc: string }[] = [
  { key: "OWN", title: "Own (Rules)", desc: "Keyword bot, ₹0 — no LLM cost" },
  { key: "CLAUDE", title: "Claude", desc: "Anthropic Haiku — smart replies" },
  { key: "GPT", title: "GPT", desc: "OpenAI GPT-4o-mini" },
  { key: "OFF", title: "Off", desc: "No auto-reply; humans only" },
];

export default function ControlPanel({ me }: { me: User }) {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [botName, setBotName] = useState("");
  const [claudeKey, setClaudeKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const isAdmin = me.role === "ADMIN";

  function load() {
    api
      .get<{ tenant: TenantSettings; usage: Usage }>("/settings")
      .then((r) => {
        setSettings(r.tenant);
        setUsage(r.usage);
        setBotName(r.tenant.botName);
      })
      .catch(() => {});
  }
  useEffect(load, []);

  async function patch(body: Record<string, unknown>) {
    if (!isAdmin) return;
    setSaving(true);
    setSaved(false);
    try {
      const r = await api.patch<{ tenant: TenantSettings }>("/settings", body);
      setSettings(r.tenant);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <div className="panel-view"><p>Loading…</p></div>;

  return (
    <div className="panel-view">
      <div className="card">
        <h2>Today's usage</h2>
        <p className="card-sub">Message counts and open conversations for {settings.name}.</p>
        <div className="row">
          <div className="stat"><div className="n">{usage?.aiToday ?? 0}</div><div className="l">AI replies today</div></div>
          <div className="stat"><div className="n">{usage?.agentToday ?? 0}</div><div className="l">Agent replies today</div></div>
          <div className="stat"><div className="n">{usage?.openConvs ?? 0}</div><div className="l">Open conversations</div></div>
        </div>
      </div>

      <div className="card">
        <h2>AI engine</h2>
        <p className="card-sub">Only one engine answers customers at a time.</p>
        <div className="engine-grid">
          {ENGINES.map((e) => (
            <div
              key={e.key}
              className={`engine ${settings.aiSource === e.key ? "sel" : ""}`}
              onClick={() => isAdmin && patch({ aiSource: e.key })}
              style={{ cursor: isAdmin ? "pointer" : "default" }}
            >
              <div className="et">{e.title}</div>
              <div className="ed">{e.desc}</div>
            </div>
          ))}
        </div>

        <div className="toggle-line">
          <span>Master AI switch</span>
          <button
            className={`btn small ${settings.aiEnabled ? "" : "ghost"}`}
            disabled={!isAdmin}
            onClick={() => patch({ aiEnabled: !settings.aiEnabled })}
          >
            {settings.aiEnabled ? "Enabled" : "Disabled"}
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="card">
          <h2>Configuration</h2>
          <p className="card-sub">Bot name and API keys. Keys are stored masked and never returned.</p>
          <div className="field">
            <label>Bot name</label>
            <input value={botName} onChange={(e) => setBotName(e.target.value)} onBlur={() => botName && patch({ botName })} />
          </div>
          <div className="field">
            <label>Claude API key {settings.claudeKey ? "(set)" : "(not set)"}</label>
            <input type="password" placeholder="sk-ant-…" value={claudeKey} onChange={(e) => setClaudeKey(e.target.value)} />
          </div>
          <div className="field">
            <label>OpenAI API key {settings.openaiKey ? "(set)" : "(not set)"}</label>
            <input type="password" placeholder="sk-…" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} />
          </div>
          <button
            className="btn small"
            disabled={saving}
            onClick={() => {
              const body: Record<string, unknown> = {};
              if (claudeKey.trim()) body.claudeKey = claudeKey.trim();
              if (openaiKey.trim()) body.openaiKey = openaiKey.trim();
              if (botName) body.botName = botName;
              patch(body).then(() => { setClaudeKey(""); setOpenaiKey(""); });
            }}
          >
            Save configuration
          </button>
          {saved && <span className="saved" style={{ marginLeft: 10 }}>Saved ✓</span>}
        </div>
      )}
    </div>
  );
}
