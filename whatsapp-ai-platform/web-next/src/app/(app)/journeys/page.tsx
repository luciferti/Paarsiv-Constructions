"use client";

import { useCallback, useEffect, useState } from "react";
import { FlaskConical, MessageSquare, Pause, Play, Timer, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { api, getSession } from "@/lib/api";
import type { Journey, JourneyStep } from "@/lib/types";

const inputCls = "w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const btnPri = "h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-8 px-3 rounded-lg border text-xs font-medium hover:bg-muted";

export default function JourneysPage() {
  const session = typeof window !== "undefined" ? getSession() : null;
  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "RM";
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [steps, setSteps] = useState<JourneyStep[]>([{ type: "message", text: "" }]);

  const load = useCallback(() => {
    api.get<{ journeys: Journey[] }>("/journeys").then((r) => setJourneys(r.journeys)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  function updateStep(i: number, patch: Partial<JourneyStep>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  async function create() {
    if (!name.trim() || !keyword.trim()) return;
    const clean = steps.filter((s) => (s.type === "message" ? (s.text || "").trim() : true));
    await api.post("/journeys", { name: name.trim(), triggerType: "keyword", triggerValue: keyword.trim(), steps: clean });
    setName(""); setKeyword(""); setSteps([{ type: "message", text: "" }]);
    setOpen(false); load();
  }

  async function toggle(j: Journey) {
    await api.patch(`/journeys/${j.id}/status`, { status: j.status === "ACTIVE" ? "DRAFT" : "ACTIVE" });
    load();
  }
  async function test(j: Journey) {
    const phone = prompt("Test phone (91…):", "919999888777");
    if (!phone) return;
    const r = await api.post<{ ran: number }>(`/journeys/${j.id}/test`, { phone });
    alert(`Ran ${r.ran} message step(s). Check that phone's thread in the Inbox.`);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 border-b bg-card/50 flex items-center">
        <div>
          <h1 className="text-xl font-semibold">Journeys</h1>
          <p className="text-sm text-muted-foreground mt-0.5">When a customer message contains a keyword, run these steps</p>
        </div>
        <div className="flex-1" />
        {canEdit && <button className={btnPri} onClick={() => setOpen(true)}>+ New journey</button>}
      </div>

      <div className="p-8 max-w-5xl space-y-4">
        {journeys.map((j) => (
          <div key={j.id} className="rounded-xl border bg-card shadow-card p-5">
            <div className="flex items-center gap-3">
              <span className="font-semibold">{j.name}</span>
              <span className="text-xs text-muted-foreground">trigger: keyword “{j.triggerValue}”</span>
              <span className={clsx(
                "text-[11px] px-2 py-0.5 rounded-full font-medium",
                j.status === "ACTIVE" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
              )}>
                {j.status.toLowerCase()}
              </span>
              <div className="flex-1" />
              {canEdit && (
                <>
                  <button className={btnGhost} onClick={() => test(j)}>
                    <FlaskConical className="w-3 h-3 inline mr-1" />Test
                  </button>
                  <button className={btnPri} onClick={() => toggle(j)}>
                    {j.status === "ACTIVE"
                      ? <><Pause className="w-3 h-3 inline mr-1" />Pause</>
                      : <><Play className="w-3 h-3 inline mr-1" />Activate</>}
                  </button>
                  <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive cursor-pointer" onClick={() => api.del(`/journeys/${j.id}`).then(load)} />
                </>
              )}
            </div>
            {/* step visualization */}
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              {j.steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={clsx(
                    "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border",
                    s.type === "message" ? "bg-accent/60 text-accent-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {s.type === "message" ? <MessageSquare className="w-3 h-3" /> : <Timer className="w-3 h-3" />}
                    {s.type === "message" ? (s.text || "").slice(0, 36) + ((s.text || "").length > 36 ? "…" : "") : `wait ${s.hours}h`}
                  </div>
                  {i < j.steps.length - 1 && <span className="text-muted-foreground">→</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {journeys.length === 0 && <p className="text-sm text-muted-foreground">No journeys yet.</p>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => setOpen(false)}>
          <div className="w-[440px] max-w-[92vw] h-full bg-card border-l flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <span className="font-semibold">New journey</span>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-md hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3 text-sm">
              <div>
                <label className="text-xs text-muted-foreground">Name</label>
                <input className={clsx(inputCls, "mt-1")} value={name} onChange={(e) => setName(e.target.value)} placeholder="Brochure follow-up" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Trigger when message contains</label>
                <input className={clsx(inputCls, "mt-1")} value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="brochure" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Steps</label>
                {steps.map((s, i) => (
                  <div key={i} className="flex gap-1.5 mt-1.5 items-center">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-[11px] grid place-items-center font-bold shrink-0">{i + 1}</span>
                    <select
                      className="h-9 px-2 rounded-lg border bg-background text-xs"
                      value={s.type}
                      onChange={(e) => updateStep(i, e.target.value === "wait" ? { type: "wait", hours: 24, text: undefined } : { type: "message", text: "" })}
                    >
                      <option value="message">Send message</option>
                      <option value="wait">Wait</option>
                    </select>
                    {s.type === "message" ? (
                      <input className="h-9 px-2 rounded-lg border bg-background text-xs flex-1" value={s.text || ""} placeholder="Message… use {{name}}" onChange={(e) => updateStep(i, { text: e.target.value })} />
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <input type="number" min={0} className="h-9 w-16 px-2 rounded-lg border bg-background text-xs" value={s.hours ?? 0} onChange={(e) => updateStep(i, { hours: Number(e.target.value) })} />
                        <span className="text-xs text-muted-foreground">hours</span>
                      </span>
                    )}
                    {steps.length > 1 && <button className={btnGhost} onClick={() => setSteps((p) => p.filter((_, idx) => idx !== i))}>×</button>}
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <button className={btnGhost} onClick={() => setSteps((p) => [...p, { type: "message", text: "" }])}>+ message</button>
                  <button className={btnGhost} onClick={() => setSteps((p) => [...p, { type: "wait", hours: 24 }])}>+ wait</button>
                </div>
              </div>
            </div>
            <div className="px-5 py-3.5 border-t flex items-center gap-2">
              <div className="flex-1" />
              <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
              <button className={btnPri} disabled={!name.trim() || !keyword.trim()} onClick={create}>Save journey</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
