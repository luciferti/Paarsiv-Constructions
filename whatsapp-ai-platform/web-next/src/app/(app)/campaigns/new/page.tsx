"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CalendarClock, Check, FileText, GalleryHorizontalEnd, Image as ImageIcon,
  Loader2, Phone, Send, Users, Video,
} from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { InboxNumber, Segment, Template } from "@/lib/types";

const input = "w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const label = "text-xs font-medium text-muted-foreground";
const btnPri = "h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted";

/** Replace {{tokens}} with readable sample values for the preview. */
const SAMPLES: Record<string, string> = {
  name: "Ravi", city: "Bengaluru", phone: "+91 98100 00001", email: "ravi@example.com",
};
function fillSamples(body: string): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => SAMPLES[k.toLowerCase()] || k);
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [allContacts, setAllContacts] = useState(0);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [numbers, setNumbers] = useState<InboxNumber[]>([]);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [when, setWhen] = useState<"draft" | "later">("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ templates: Template[] }>("/templates").then((r) => setTemplates(r.templates)).catch(() => {});
    api.get<{ segments: Segment[] }>("/segments").then((r) => setSegments(r.segments)).catch(() => {});
    api.get<{ total: number }>("/contacts").then((r) => setAllContacts(r.total)).catch(() => {});
    api.get<{ numbers: InboxNumber[] }>("/conversations/numbers")
      .then((r) => {
        const usable = r.numbers.filter((n) => n.active);
        setNumbers(usable);
        setPhoneNumberId((prev) => prev || usable.find((n) => n.isDefault)?.phoneNumberId || usable[0]?.phoneNumberId || "");
      })
      .catch(() => {});
  }, []);

  const template = templates.find((t) => t.id === templateId) || null;
  const segment = segments.find((s) => s.id === segmentId) || null;
  const audience = segment ? segment.count : allContacts;

  async function create() {
    setErr(null);
    if (!name.trim() || !templateId) { setErr("Name and template are required."); return; }
    if (when === "later" && !scheduledAt) { setErr("Pick a date and time to schedule."); return; }
    setSaving(true);
    try {
      await api.post("/campaigns", {
        name: name.trim(),
        templateId,
        segmentId: segmentId || null,
        ...(phoneNumberId ? { phoneNumberId } : {}),
        ...(when === "later" ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
      });
      router.push("/campaigns");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create the campaign.");
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* top bar */}
      <div className="h-16 shrink-0 border-b bg-card/60 flex items-center gap-3 px-6">
        <button onClick={() => router.push("/campaigns")} className="p-2 -ml-2 rounded-lg hover:bg-muted" title="Back to campaigns">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-base font-semibold">New campaign</h1>
          <p className="text-xs text-muted-foreground">Pick a template, choose who receives it, then send or schedule</p>
        </div>
        <div className="flex-1" />
        {err && <span className="text-xs text-destructive mr-2">{err}</span>}
        <button className={btnGhost} onClick={() => router.push("/campaigns")}>Cancel</button>
        <button className={btnPri} onClick={create} disabled={saving || !name.trim() || !templateId}>
          {saving && <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />}
          {when === "later" ? "Schedule campaign" : "Create campaign"}
        </button>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* form */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-8 space-y-8">
            {/* 1. name */}
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">
                <span className="text-muted-foreground mr-1.5">1.</span>Campaign name
              </h2>
              <input className={input} value={name} placeholder="Diwali launch — Bengaluru"
                onChange={(e) => setName(e.target.value)} />
            </section>

            {/* 2. template */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">
                <span className="text-muted-foreground mr-1.5">2.</span>Message template
              </h2>
              {templates.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">No templates yet.</p>
                  <button className={clsx(btnGhost, "mt-3")} onClick={() => router.push("/templates/new")}>Create a template</button>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                  {templates.map((t) => {
                    const sel = t.id === templateId;
                    const media = ["image", "video", "document"].includes(t.headerType);
                    return (
                      <button key={t.id} onClick={() => setTemplateId(t.id)}
                        className={clsx(
                          "text-left rounded-xl border-2 overflow-hidden transition-all",
                          sel ? "border-primary ring-2 ring-primary/20" : "hover:border-border"
                        )}>
                        {t.type === "carousel" && t.cards.length > 0 ? (
                          <div className="flex gap-0.5 h-20 bg-muted">
                            {t.cards.slice(0, 3).map((c, i) => c.assetUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={i} src={c.assetUrl} alt="" className="h-20 flex-1 min-w-0 object-cover" />
                            ) : (
                              <span key={i} className="h-20 flex-1 grid place-items-center"><ImageIcon className="w-4 h-4 text-muted-foreground" /></span>
                            ))}
                          </div>
                        ) : media ? (
                          t.headerAssetUrl && t.headerType === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={t.headerAssetUrl} alt="" className="w-full h-20 object-cover" />
                          ) : (
                            <div className="w-full h-20 bg-muted grid place-items-center">
                              {t.headerType === "video" ? <Video className="w-5 h-5 text-muted-foreground" /> : <FileText className="w-5 h-5 text-muted-foreground" />}
                            </div>
                          )
                        ) : null}
                        <div className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold truncate flex-1">{t.name}</span>
                            {sel && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.body}</p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className={clsx(
                              "text-[10px] px-1.5 py-px rounded font-semibold",
                              (t.metaStatus || t.status) === "APPROVED" ? "bg-success/15 text-success" :
                              (t.metaStatus || t.status) === "PENDING" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"
                            )}>
                              {(t.metaStatus || t.status || "").toLowerCase().replace("_", " ")}
                            </span>
                            {t.type === "carousel" && (
                              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                                <GalleryHorizontalEnd className="w-3 h-3" />{t.cards.length}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 3. audience */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">
                <span className="text-muted-foreground mr-1.5">3.</span>Audience
              </h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                <button onClick={() => setSegmentId("")}
                  className={clsx("text-left rounded-xl border-2 p-4 transition-colors",
                    segmentId === "" ? "border-primary bg-accent" : "hover:bg-muted/60")}>
                  <div className="flex items-center gap-2">
                    <Users className={clsx("w-4 h-4", segmentId === "" ? "text-primary" : "text-muted-foreground")} />
                    <span className="text-sm font-semibold flex-1">All contacts</span>
                    {segmentId === "" && <Check className="w-3.5 h-3.5 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Everyone opted in · {allContacts}</p>
                </button>
                {segments.map((s) => {
                  const sel = s.id === segmentId;
                  return (
                    <button key={s.id} onClick={() => setSegmentId(s.id)}
                      className={clsx("text-left rounded-xl border-2 p-4 transition-colors",
                        sel ? "border-primary bg-accent" : "hover:bg-muted/60")}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold flex-1 truncate">{s.name}</span>
                        {sel && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{s.count} contacts</p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 4. sending number */}
            {numbers.length > 1 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold">
                  <span className="text-muted-foreground mr-1.5">4.</span>Send from
                </h2>
                <p className="text-xs text-muted-foreground -mt-1">
                  Replies land in this number&apos;s inbox, so pick the one the team watching this campaign uses.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {numbers.map((n) => {
                    const sel = n.phoneNumberId === phoneNumberId;
                    return (
                      <button key={n.phoneNumberId} onClick={() => setPhoneNumberId(n.phoneNumberId)}
                        className={clsx("text-left rounded-xl border-2 p-4 transition-colors",
                          sel ? "border-primary bg-accent" : "hover:bg-muted/60")}>
                        <div className="flex items-center gap-2">
                          <Phone className={clsx("w-4 h-4", sel ? "text-primary" : "text-muted-foreground")} />
                          <span className="text-sm font-medium flex-1">{n.label || n.displayPhoneNumber}</span>
                          {sel && <Check className="w-3.5 h-3.5 text-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {n.displayPhoneNumber}{n.isDefault ? " · default" : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 5. schedule */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">
                <span className="text-muted-foreground mr-1.5">{numbers.length > 1 ? 5 : 4}.</span>When to send
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ["draft", "Save as draft", "Review it, then send manually from the list", Send],
                  ["later", "Schedule", "Sends automatically at the time you pick", CalendarClock],
                ] as const).map(([v, title, desc, Icon]) => (
                  <button key={v} onClick={() => setWhen(v)}
                    className={clsx("text-left rounded-xl border-2 p-4 transition-colors",
                      when === v ? "border-primary bg-accent" : "hover:bg-muted/60")}>
                    <div className="flex items-center gap-2">
                      <Icon className={clsx("w-4 h-4", when === v ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-sm font-semibold">{title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
              {when === "later" && (
                <input type="datetime-local" className={input} value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)} />
              )}
            </section>
          </div>
        </div>

        {/* preview */}
        <aside className="w-[380px] shrink-0 border-l bg-muted/30 overflow-y-auto hidden lg:block">
          <div className="p-6 space-y-5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Message preview</div>
              {template ? (
                <div className="rounded-2xl bg-card border shadow-lg overflow-hidden">
                  {template.type === "carousel" && template.cards.length > 0 ? (
                    <div className="flex gap-2 p-3 overflow-x-auto">
                      {template.cards.map((c, i) => (
                        <div key={i} className="w-40 shrink-0 rounded-xl border overflow-hidden bg-background">
                          {c.assetUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.assetUrl} alt="" className="w-full h-24 object-cover" />
                          ) : (
                            <div className="w-full h-24 bg-muted grid place-items-center"><ImageIcon className="w-5 h-5 text-muted-foreground" /></div>
                          )}
                          <p className="text-xs p-2">{c.body}</p>
                        </div>
                      ))}
                    </div>
                  ) : template.headerAssetUrl && template.headerType === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={template.headerAssetUrl} alt="" className="w-full max-h-64 object-cover" />
                  ) : ["video", "document"].includes(template.headerType) ? (
                    <div className="w-full h-32 bg-muted grid place-items-center">
                      {template.headerType === "video" ? <Video className="w-7 h-7 text-muted-foreground" /> : <FileText className="w-7 h-7 text-muted-foreground" />}
                    </div>
                  ) : null}
                  <div className="p-4 space-y-2">
                    {template.headerType === "text" && template.headerText && (
                      <p className="text-[15px] font-semibold leading-snug">{template.headerText}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{fillSamples(template.body)}</p>
                    {template.footerText && <p className="text-[11px] text-muted-foreground pt-1">{template.footerText}</p>}
                  </div>
                  {template.buttons?.length > 0 && (
                    <div className="border-t divide-y">
                      {template.buttons.map((b, i) => (
                        <div key={i} className="text-center text-sm text-primary py-2.5 font-medium">{b.text}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-8 text-center text-xs text-muted-foreground">
                  Pick a template to preview the message
                </div>
              )}
              {template && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Variables shown with sample values — each contact gets their own details.
                </p>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Summary</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Audience</span>
                  <span className="font-medium text-right">{segment ? segment.name : "All contacts"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Recipients</span>
                  <span className="font-semibold text-primary">{audience}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Template</span>
                  <span className="font-medium text-right truncate">{template?.name || "—"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Sending</span>
                  <span className="font-medium text-right">
                    {when === "later" ? (scheduledAt ? new Date(scheduledAt).toLocaleString() : "Scheduled") : "Manually"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
