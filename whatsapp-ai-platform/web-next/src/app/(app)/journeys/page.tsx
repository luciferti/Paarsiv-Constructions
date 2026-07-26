"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, MessageSquare, Pause, Play, Timer, Trash2, UserCheck, Tag as TagIcon } from "lucide-react";
import clsx from "clsx";
import { api, getSession } from "@/lib/api";
import type { Journey, JourneyStep } from "@/lib/types";

const inputCls = "w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const btnPri = "h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-8 px-3 rounded-lg border text-xs font-medium hover:bg-muted";

export default function JourneysPage() {
  const router = useRouter();
  const session = typeof window !== "undefined" ? getSession() : null;
  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "RM";
  const [journeys, setJourneys] = useState<Journey[]>([]);

  const load = useCallback(() => {
    api.get<{ journeys: Journey[] }>("/journeys").then((r) => setJourneys(r.journeys)).catch(() => {});
  }, []);
  useEffect(load, [load]);

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
        {canEdit && <button className={btnPri} onClick={() => router.push('/journeys/new')}>+ New journey</button>}
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
                  <button className={btnGhost} onClick={() => router.push(`/journeys/${j.id}`)}>Edit</button>
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
                    s.type === "message" ? "bg-accent/60 text-accent-foreground"
                      : s.type === "handoff" ? "bg-success/15 text-success"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {s.type === "message" ? <MessageSquare className="w-3 h-3" />
                      : s.type === "wait" ? <Timer className="w-3 h-3" />
                      : s.type === "handoff" ? <UserCheck className="w-3 h-3" />
                      : <TagIcon className="w-3 h-3" />}
                    {s.type === "message" ? (s.text || "").slice(0, 36) + ((s.text || "").length > 36 ? "…" : "")
                      : s.type === "wait" ? `wait ${s.hours}h`
                      : s.type === "handoff" ? "handoff to agent"
                      : `tag ${s.tag || ""}`}
                  </div>
                  {i < j.steps.length - 1 && <span className="text-muted-foreground">→</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {journeys.length === 0 && <p className="text-sm text-muted-foreground">No journeys yet.</p>}
      </div>

    </div>
  );
}
