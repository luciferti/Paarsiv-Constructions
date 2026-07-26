"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, FileText, GalleryHorizontalEnd, Heading,
  Image as ImageIcon, Loader2, Pencil, RefreshCw, Trash2, Video, X, XCircle,
} from "lucide-react";
import clsx from "clsx";
import { api, getSession } from "@/lib/api";
import FolderSidebar from "@/components/FolderSidebar";
import type { Asset, Folder, Template, TemplateButton, TemplateCard } from "@/lib/types";

type Draft = {
  id?: string;
  name: string; category: string; folderId: string;
  type: "standard" | "carousel";
  headerType: Template["headerType"];
  headerText: string; headerAssetId: string;
  body: string; footerText: string;
  buttons: TemplateButton[]; cards: TemplateCard[];
};

const emptyDraft: Draft = {
  name: "", category: "MARKETING", folderId: "", type: "standard",
  headerType: "none", headerText: "", headerAssetId: "",
  body: "", footerText: "", buttons: [], cards: [],
};

const inputCls = "w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const btnPri = "h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-8 px-3 rounded-lg border text-xs font-medium hover:bg-muted";

/** Meta review status → badge styling. Falls back to the local status. */
function statusBadge(t: Template): { label: string; cls: string; icon: React.ElementType; title?: string } {
  const s = (t.metaStatus || t.status || "").toUpperCase();
  if (s === "APPROVED") return { label: "approved", cls: "bg-success/15 text-success", icon: CheckCircle2 };
  if (s === "PENDING" || s === "IN_APPEAL" || s === "PENDING_DELETION")
    return { label: "pending review", cls: "bg-warning/15 text-warning", icon: Clock };
  if (s === "REJECTED") return { label: "rejected", cls: "bg-destructive/15 text-destructive", icon: XCircle, title: t.metaError || undefined };
  if (s === "PAUSED") return { label: "paused", cls: "bg-warning/15 text-warning", icon: AlertTriangle, title: t.metaError || undefined };
  if (s === "DISABLED") return { label: "disabled", cls: "bg-destructive/15 text-destructive", icon: XCircle };
  if (s === "SUBMIT_FAILED") return { label: "submit failed", cls: "bg-destructive/15 text-destructive", icon: XCircle, title: t.metaError || undefined };
  if (s === "LOCAL") return { label: "local only", cls: "bg-muted text-muted-foreground", icon: FileText, title: "Connect a WhatsApp number to submit this to Meta" };
  return { label: s.toLowerCase() || "draft", cls: "bg-muted text-muted-foreground", icon: FileText };
}

/** Media preview used by cards and the drawer preview. */
function MediaThumb({ url, kind, className }: { url?: string | null; kind: string; className?: string }) {
  if (url && kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={clsx("w-full object-cover", className)} />;
  }
  const Icon = kind === "video" ? Video : kind === "document" ? FileText : ImageIcon;
  return (
    <div className={clsx("w-full grid place-items-center bg-muted", className)}>
      <Icon className="w-6 h-6 text-muted-foreground" />
    </div>
  );
}

export default function TemplatesPage() {
  const session = typeof window !== "undefined" ? getSession() : null;
  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "RM";
  const [templates, setTemplates] = useState<Template[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [active, setActive] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadTemplates = useCallback(() => {
    api.get<{ templates: Template[] }>("/templates").then((r) => setTemplates(r.templates)).catch(() => {});
  }, []);
  const loadFolders = useCallback(() => {
    api.get<{ folders: Folder[] }>("/template-folders").then((r) => setFolders(r.folders)).catch(() => {});
  }, []);
  useEffect(() => {
    loadTemplates(); loadFolders();
    api.get<{ assets: Asset[] }>("/assets").then((r) => setAssets(r.assets)).catch(() => {});
  }, [loadTemplates, loadFolders]);

  const shown = templates.filter((t) => (active ? t.folderId === active : true));
  const counts = new Map<string, number>();
  for (const t of templates) if (t.folderId) counts.set(t.folderId, (counts.get(t.folderId) || 0) + 1);

  function openNew() { setErr(null); setDraft({ ...emptyDraft, folderId: active }); }
  function openEdit(t: Template) {
    setErr(null);
    setDraft({
      id: t.id, name: t.name, category: t.category, folderId: t.folderId || "",
      type: t.type, headerType: t.headerType, headerText: t.headerText || "", headerAssetId: t.headerAssetId || "",
      body: t.body, footerText: t.footerText || "", buttons: t.buttons || [], cards: t.cards || [],
    });
  }
  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  async function save() {
    if (!draft) return;
    setErr(null);
    if (!draft.name.trim() || !draft.body.trim()) { setErr("Name and body are required"); return; }
    const payload = {
      name: draft.name.trim(), category: draft.category, folderId: draft.folderId || null,
      type: draft.type,
      headerType: draft.type === "carousel" ? "none" : draft.headerType,
      headerText: draft.headerType === "text" ? draft.headerText : undefined,
      headerAssetId: ["image", "video", "document"].includes(draft.headerType) ? draft.headerAssetId || undefined : undefined,
      body: draft.body, footerText: draft.footerText || undefined,
      buttons: draft.type === "standard" ? draft.buttons : [],
      cards: draft.type === "carousel" ? draft.cards : [],
    };
    try {
      if (draft.id) {
        await api.patch(`/templates/${draft.id}`, payload);
        setNotice("Saved locally. Resubmit to Meta to update the approved version.");
      } else {
        const r = await api.post<{ meta: { submitted: boolean; skipped: boolean; error: string | null } }>("/templates", payload);
        setNotice(
          r.meta.submitted
            ? "Submitted to Meta — status will show as pending review until approved."
            : r.meta.skipped
              ? "Saved locally. Connect a WhatsApp number in AI Control to submit templates to Meta."
              : `Saved, but Meta rejected the submission: ${r.meta.error}`
        );
      }
      setDraft(null); loadTemplates();
      setTimeout(() => setNotice(null), 8000);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }

  async function syncMeta() {
    setSyncing(true);
    try {
      const r = await api.post<{ ok: boolean; updated: number; error?: string }>("/templates/sync");
      setNotice(r.ok ? `Synced ${r.updated} template statuses from Meta.` : `Sync failed: ${r.error}`);
      loadTemplates();
      setTimeout(() => setNotice(null), 6000);
    } finally { setSyncing(false); }
  }

  return (
    <div className="flex-1 flex min-h-0">
      <FolderSidebar
        allLabel="All templates"
        allCount={templates.length}
        folders={folders.map((f) => ({ ...f, count: counts.get(f.id) || 0 }))}
        active={active}
        onSelect={setActive}
        canEdit={!!canEdit}
        onNewFolder={(n) => api.post("/template-folders", { name: n }).then(loadFolders)}
        onDeleteFolder={(id) => api.del(`/template-folders/${id}`).then(() => { if (active === id) setActive(""); loadFolders(); loadTemplates(); })}
      />

      <section className="flex-1 min-w-0 flex flex-col bg-background">
        <div className="px-6 py-4 border-b bg-card/50 flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold">{active ? folders.find((f) => f.id === active)?.name || "Folder" : "All templates"}</h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full border text-muted-foreground">{shown.length}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Submitted to Meta for approval. Use {"{{name}}"} and {"{{city}}"} to personalize.
            </p>
          </div>
          <div className="flex-1" />
          {canEdit && (
            <button className={btnGhost} onClick={syncMeta} disabled={syncing}>
              {syncing ? <Loader2 className="w-3 h-3 inline mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 inline mr-1" />}
              Sync with Meta
            </button>
          )}
          {canEdit && <button className={btnPri} onClick={openNew}>+ New template</button>}
        </div>
        {notice && <div className="px-6 py-2 text-xs text-primary bg-accent/60 border-b">{notice}</div>}

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 content-start">
          {shown.map((t) => {
            const badge = statusBadge(t);
            const BadgeIcon = badge.icon;
            const hasMediaHeader = ["image", "video", "document"].includes(t.headerType);
            return (
              <div key={t.id} className="rounded-xl border bg-card shadow-card overflow-hidden flex flex-col">
                {/* header media preview */}
                {t.type === "carousel" && t.cards.length > 0 ? (
                  <div className="flex gap-1 h-28 bg-muted overflow-hidden">
                    {t.cards.slice(0, 3).map((cd, i) => (
                      <MediaThumb key={i} url={cd.assetUrl} kind="image" className="h-28 flex-1 min-w-0" />
                    ))}
                  </div>
                ) : hasMediaHeader ? (
                  <MediaThumb url={t.headerAssetUrl} kind={t.headerType} className="h-28" />
                ) : null}

                <div className="p-4 flex flex-col gap-2 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate">{t.name}</span>
                    <span className="text-[10px] px-1.5 py-px rounded bg-accent text-accent-foreground font-medium shrink-0">
                      {(t.metaCategory || t.category).toLowerCase()}
                    </span>
                  </div>

                  {/* Meta review status */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      title={badge.title}
                      className={clsx("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold", badge.cls)}
                    >
                      <BadgeIcon className="w-3 h-3" />{badge.label}
                    </span>
                    {t.type === "carousel" && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <GalleryHorizontalEnd className="w-3 h-3" />{t.cards.length} cards
                      </span>
                    )}
                    {t.type !== "carousel" && t.headerType !== "none" && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        {t.headerType === "text" ? <Heading className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}{t.headerType}
                      </span>
                    )}
                  </div>

                  {t.headerType === "text" && t.headerText && (
                    <p className="text-[13px] font-semibold">{t.headerText}</p>
                  )}
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/90">{t.body}</p>
                  {t.footerText && <p className="text-[11px] text-muted-foreground">{t.footerText}</p>}
                  {t.buttons?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {t.buttons.map((b, i) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 rounded-md border text-primary">{b.text}</span>
                      ))}
                    </div>
                  )}
                  {t.metaError && (
                    <p className="text-[10px] text-destructive leading-snug">{t.metaError}</p>
                  )}

                  <div className="mt-auto pt-1 flex items-center gap-1.5 flex-wrap">
                    {t.tokens.map((tk) => (
                      <span key={tk} className="text-[10px] px-1.5 py-px rounded bg-muted text-muted-foreground">{`{{${tk}}}`}</span>
                    ))}
                    <div className="flex-1" />
                    {canEdit && (
                      <>
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-primary cursor-pointer" onClick={() => openEdit(t)} />
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive cursor-pointer" onClick={() => api.del(`/templates/${t.id}`).then(loadTemplates)} />
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {shown.length === 0 && <p className="text-sm text-muted-foreground col-span-full">No templates here yet.</p>}
        </div>
      </section>

      {/* Builder drawer */}
      {draft && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => setDraft(null)}>
          <div className="w-[440px] max-w-[92vw] h-full bg-card border-l flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <span className="font-semibold">{draft.id ? "Edit template" : "New template"}</span>
              <button onClick={() => setDraft(null)} className="p-1.5 rounded-md hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 text-sm">
              {/* live WhatsApp-style preview */}
              <div className="rounded-xl bg-muted/50 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Preview</div>
                <div className="rounded-xl bg-card border shadow-sm overflow-hidden max-w-[280px]">
                  {draft.type === "carousel" ? (
                    draft.cards.length > 0 && (
                      <div className="flex gap-1 h-24 bg-muted overflow-hidden">
                        {draft.cards.slice(0, 3).map((cd, i) => (
                          <MediaThumb key={i} url={assets.find((a) => a.id === cd.assetId)?.url} kind="image" className="h-24 flex-1 min-w-0" />
                        ))}
                      </div>
                    )
                  ) : ["image", "video", "document"].includes(draft.headerType) ? (
                    <MediaThumb url={assets.find((a) => a.id === draft.headerAssetId)?.url} kind={draft.headerType} className="h-24" />
                  ) : null}
                  <div className="p-2.5 space-y-1">
                    {draft.headerType === "text" && draft.headerText && (
                      <p className="text-[13px] font-semibold">{draft.headerText}</p>
                    )}
                    <p className="text-[13px] whitespace-pre-wrap">{draft.body || "Your message body…"}</p>
                    {draft.footerText && <p className="text-[10px] text-muted-foreground">{draft.footerText}</p>}
                  </div>
                  {draft.buttons.filter((b) => b.text).length > 0 && (
                    <div className="border-t divide-y">
                      {draft.buttons.filter((b) => b.text).map((b, i) => (
                        <div key={i} className="text-center text-[12px] text-primary py-1.5">{b.text}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Name</label>
                <input className={clsx(inputCls, "mt-1")} value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Welcome offer" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Category</label>
                  <select className={clsx(inputCls, "mt-1")} value={draft.category} onChange={(e) => patch({ category: e.target.value })}>
                    <option value="MARKETING">Marketing</option>
                    <option value="UTILITY">Utility</option>
                    <option value="AUTHENTICATION">Authentication</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Folder</label>
                  <select className={clsx(inputCls, "mt-1")} value={draft.folderId} onChange={(e) => patch({ folderId: e.target.value })}>
                    <option value="">No folder</option>
                    {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Type</label>
                <div className="flex gap-1.5 mt-1">
                  {(["standard", "carousel"] as const).map((ty) => (
                    <button
                      key={ty}
                      className={clsx(
                        "flex-1 h-9 rounded-lg border text-xs font-medium capitalize",
                        draft.type === ty ? "bg-accent text-accent-foreground border-primary" : "text-muted-foreground hover:bg-muted"
                      )}
                      onClick={() => patch({ type: ty })}
                    >
                      {ty}
                    </button>
                  ))}
                </div>
              </div>

              {draft.type === "standard" && (
                <div>
                  <label className="text-xs text-muted-foreground">Header</label>
                  <select className={clsx(inputCls, "mt-1")} value={draft.headerType} onChange={(e) => patch({ headerType: e.target.value as Draft["headerType"] })}>
                    <option value="none">None</option>
                    <option value="text">Text</option>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                    <option value="document">Document</option>
                  </select>
                  {draft.headerType === "text" && (
                    <input className={clsx(inputCls, "mt-2")} value={draft.headerText} onChange={(e) => patch({ headerText: e.target.value })} placeholder="Header text" />
                  )}
                  {["image", "video", "document"].includes(draft.headerType) && (
                    <select className={clsx(inputCls, "mt-2")} value={draft.headerAssetId} onChange={(e) => patch({ headerAssetId: e.target.value })}>
                      <option value="">— pick from media library —</option>
                      {assets.map((a) => <option key={a.id} value={a.id}>{a.originalName}</option>)}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground">Body</label>
                <textarea
                  rows={4}
                  className="mt-1 w-full px-3 py-2 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring resize-y"
                  value={draft.body}
                  onChange={(e) => patch({ body: e.target.value })}
                  placeholder="Hi {{name}}, we have new launches in {{city}}!"
                />
              </div>

              {draft.type === "standard" && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Footer</label>
                    <input className={clsx(inputCls, "mt-1")} value={draft.footerText} onChange={(e) => patch({ footerText: e.target.value })} placeholder="Optional" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Buttons</label>
                    {draft.buttons.map((b, i) => (
                      <div key={i} className="flex gap-1.5 mt-1.5 items-center">
                        <select
                          className="h-9 px-2 rounded-lg border bg-background text-xs"
                          value={b.type}
                          onChange={(e) => patch({ buttons: draft.buttons.map((x, idx) => idx === i ? { ...x, type: e.target.value as TemplateButton["type"] } : x) })}
                        >
                          <option value="quick_reply">Quick reply</option>
                          <option value="url">Link</option>
                          <option value="phone">Call</option>
                        </select>
                        <input className="h-9 px-2 rounded-lg border bg-background text-xs flex-1" value={b.text} placeholder="Text" onChange={(e) => patch({ buttons: draft.buttons.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x) })} />
                        {b.type !== "quick_reply" && (
                          <input className="h-9 px-2 rounded-lg border bg-background text-xs w-28" value={b.value || ""} placeholder={b.type === "url" ? "https://…" : "+91…"} onChange={(e) => patch({ buttons: draft.buttons.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x) })} />
                        )}
                        <button className={btnGhost} onClick={() => patch({ buttons: draft.buttons.filter((_, idx) => idx !== i) })}>×</button>
                      </div>
                    ))}
                    {draft.buttons.length < 3 && (
                      <button className={clsx(btnGhost, "mt-2")} onClick={() => patch({ buttons: [...draft.buttons, { type: "quick_reply", text: "" }] })}>+ button</button>
                    )}
                  </div>
                </>
              )}

              {draft.type === "carousel" && (
                <div>
                  <label className="text-xs text-muted-foreground">Cards ({draft.cards.length}/10)</label>
                  {draft.cards.map((c, i) => (
                    <div key={i} className="mt-2 rounded-lg border bg-muted/40 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>Card {i + 1}</span>
                        <X className="w-3.5 h-3.5 cursor-pointer text-muted-foreground hover:text-destructive" onClick={() => patch({ cards: draft.cards.filter((_, idx) => idx !== i) })} />
                      </div>
                      <select
                        className="w-full h-8 px-2 rounded-lg border bg-background text-xs"
                        value={c.assetId || ""}
                        onChange={(e) => patch({ cards: draft.cards.map((x, idx) => idx === i ? { ...x, assetId: e.target.value } : x) })}
                      >
                        <option value="">— card image —</option>
                        {assets.map((a) => <option key={a.id} value={a.id}>{a.originalName}</option>)}
                      </select>
                      <input
                        className="w-full h-8 px-2 rounded-lg border bg-background text-xs"
                        value={c.body}
                        placeholder="Card text"
                        onChange={(e) => patch({ cards: draft.cards.map((x, idx) => idx === i ? { ...x, body: e.target.value } : x) })}
                      />
                    </div>
                  ))}
                  {draft.cards.length < 10 && (
                    <button className={clsx(btnGhost, "mt-2")} onClick={() => patch({ cards: [...draft.cards, { body: "" }] })}>+ card</button>
                  )}
                </div>
              )}

              {err && <p className="text-xs text-destructive">{err}</p>}
            </div>

            <div className="px-5 py-3.5 border-t flex items-center gap-2">
              {draft.id && (
                <button className="h-8 px-3 rounded-lg bg-destructive text-white text-xs font-medium" onClick={() => api.del(`/templates/${draft.id}`).then(() => { setDraft(null); loadTemplates(); })}>Delete</button>
              )}
              <div className="flex-1" />
              <button className={btnGhost} onClick={() => setDraft(null)}>Cancel</button>
              <button className={btnPri} disabled={!draft.name.trim()} onClick={save}>{draft.id ? "Save" : "Create"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
