"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, CheckCircle2, Clock, FileText, GalleryHorizontalEnd, Heading,
  Image as ImageIcon, Loader2, Pencil, RefreshCw, Trash2, Video, XCircle,
} from "lucide-react";
import clsx from "clsx";
import { api, getSession } from "@/lib/api";
import FolderSidebar from "@/components/FolderSidebar";
import Pagination, { EMPTY_PAGE, type PageMeta } from "@/components/Pagination";
import type { Folder, Template } from "@/lib/types";

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
  const router = useRouter();
  const session = typeof window !== "undefined" ? getSession() : null;
  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "RM";
  const [templates, setTemplates] = useState<Template[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [active, setActive] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [meta, setMeta] = useState<PageMeta>(EMPTY_PAGE);
  const [page, setPage] = useState(1);

  const loadTemplates = useCallback(() => {
    const q = new URLSearchParams({ page: String(page), pageSize: "24" });
    if (active) q.set("folderId", active);
    api.get<{ templates: Template[] } & PageMeta>(`/templates?${q}`)
      .then((r) => {
        setTemplates(r.templates);
        setMeta({ total: r.total, page: r.page, pageSize: r.pageSize, pages: r.pages });
      })
      .catch(() => {});
  }, [page, active]);
  const loadFolders = useCallback(() => {
    api.get<{ folders: Folder[] }>("/template-folders").then((r) => setFolders(r.folders)).catch(() => {});
  }, []);
  useEffect(() => { setPage(1); }, [active]);
  useEffect(() => {
    loadTemplates(); loadFolders();
  }, [loadTemplates, loadFolders]);

  const shown = templates;
  const counts = new Map<string, number>();
  for (const t of templates) if (t.folderId) counts.set(t.folderId, (counts.get(t.folderId) || 0) + 1);

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
        allCount={meta.total}
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
          {canEdit && <button className={btnPri} onClick={() => router.push('/templates/new')}>+ New template</button>}
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
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-primary cursor-pointer" onClick={() => router.push(`/templates/${t.id}`)} />
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive cursor-pointer" onClick={() => api.del(`/templates/${t.id}`).then(loadTemplates)} />
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {shown.length === 0 && <p className="text-sm text-muted-foreground col-span-full">No templates here yet.</p>}
          <div className="col-span-full"><Pagination meta={meta} label="templates" onPage={setPage} /></div>
        </div>
      </section>

    </div>
  );
}
