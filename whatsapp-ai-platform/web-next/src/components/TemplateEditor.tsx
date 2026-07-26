"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, FileText, GalleryHorizontalEnd, Image as ImageIcon,
  Loader2, Plus, Trash2, Upload, Video, X,
} from "lucide-react";
import clsx from "clsx";
import { api, getToken } from "@/lib/api";
import type { Asset, Folder, Template, TemplateButton, TemplateCard } from "@/lib/types";

type HeaderType = "none" | "text" | "image" | "video" | "document";

interface Draft {
  name: string; category: string; language: string; folderId: string;
  type: "standard" | "carousel";
  headerType: HeaderType; headerText: string; headerAssetId: string;
  body: string; footerText: string;
  buttons: TemplateButton[]; cards: TemplateCard[];
}

const EMPTY: Draft = {
  name: "", category: "MARKETING", language: "en", folderId: "", type: "standard",
  headerType: "none", headerText: "", headerAssetId: "",
  body: "", footerText: "", buttons: [], cards: [],
};

const TOKENS = ["name", "city", "phone", "email"];
const input = "w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const label = "text-xs font-medium text-muted-foreground";
const btnPri = "h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted";

function assetKind(mime: string): HeaderType {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

/** Visual media picker: real thumbnails in a grid, not a list of filenames. */
function MediaPicker({
  assets, kind, selectedId, onSelect, onUploaded,
}: {
  assets: Asset[]; kind: HeaderType; selectedId: string;
  onSelect: (id: string) => void; onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const usable = assets.filter((a) => assetKind(a.mimeType) === kind);

  async function upload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = (await res.json()) as { asset?: Asset };
      onUploaded();
      if (data.asset) onSelect(data.asset.id);
    } finally { setUploading(false); }
  }

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2.5">
        {/* upload tile */}
        <button
          onClick={() => fileRef.current?.click()}
          className="aspect-square rounded-xl border-2 border-dashed grid place-items-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <span className="text-center">
              <Upload className="w-5 h-5 mx-auto" />
              <span className="block text-[11px] mt-1">Upload</span>
            </span>
          )}
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />

        {usable.map((a) => {
          const sel = a.id === selectedId;
          return (
            <button
              key={a.id}
              onClick={() => onSelect(sel ? "" : a.id)}
              title={a.originalName}
              className={clsx(
                "relative aspect-square rounded-xl overflow-hidden border-2 transition-all group",
                sel ? "border-primary ring-2 ring-primary/25" : "border-transparent hover:border-border"
              )}
            >
              {kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt={a.originalName} className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full bg-muted grid place-items-center">
                  {kind === "video" ? <Video className="w-6 h-6 text-muted-foreground" /> : <FileText className="w-6 h-6 text-muted-foreground" />}
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[10px] px-1.5 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                {a.originalName}
              </span>
              {sel && (
                <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary grid place-items-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {usable.length === 0 && (
        <p className="text-xs text-muted-foreground mt-2">No {kind}s in the media library yet — upload one above.</p>
      )}
    </div>
  );
}

export default function TemplateEditor({ templateId }: { templateId?: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(!!templateId);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const loadAssets = useCallback(() => {
    api.get<{ assets: Asset[] }>("/assets").then((r) => setAssets(r.assets)).catch(() => {});
  }, []);

  useEffect(() => {
    loadAssets();
    api.get<{ folders: Folder[] }>("/template-folders").then((r) => setFolders(r.folders)).catch(() => {});
    if (templateId) {
      api.get<{ templates: Template[] }>("/templates")
        .then((r) => {
          const t = r.templates.find((x) => x.id === templateId);
          if (t) {
            setDraft({
              name: t.name, category: t.category, language: t.language || "en",
              folderId: t.folderId || "", type: t.type,
              headerType: t.headerType, headerText: t.headerText || "", headerAssetId: t.headerAssetId || "",
              body: t.body, footerText: t.footerText || "",
              buttons: t.buttons || [], cards: t.cards || [],
            });
          }
        })
        .finally(() => setLoading(false));
    }
  }, [templateId, loadAssets]);

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  function insertToken(tk: string) {
    const el = bodyRef.current;
    const token = `{{${tk}}}`;
    if (!el) { patch({ body: draft.body + token }); return; }
    const start = el.selectionStart ?? draft.body.length;
    const end = el.selectionEnd ?? start;
    const next = draft.body.slice(0, start) + token + draft.body.slice(end);
    patch({ body: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save() {
    setErr(null);
    if (!draft.name.trim() || !draft.body.trim()) { setErr("Name and body are required."); return; }
    setSaving(true);
    const payload = {
      name: draft.name.trim(), category: draft.category, language: draft.language,
      folderId: draft.folderId || null, type: draft.type,
      headerType: draft.type === "carousel" ? "none" : draft.headerType,
      headerText: draft.headerType === "text" ? draft.headerText : undefined,
      headerAssetId: ["image", "video", "document"].includes(draft.headerType) ? draft.headerAssetId || undefined : undefined,
      body: draft.body, footerText: draft.footerText || undefined,
      buttons: draft.type === "standard" ? draft.buttons.filter((b) => b.text.trim()) : [],
      cards: draft.type === "carousel" ? draft.cards : [],
    };
    try {
      if (templateId) await api.patch(`/templates/${templateId}`, payload);
      else await api.post("/templates", payload);
      router.push("/templates");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save the template.");
      setSaving(false);
    }
  }

  const headerAsset = assets.find((a) => a.id === draft.headerAssetId);
  const isMediaHeader = ["image", "video", "document"].includes(draft.headerType);

  if (loading) {
    return <div className="flex-1 grid place-items-center text-sm text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* top bar */}
      <div className="h-16 shrink-0 border-b bg-card/60 flex items-center gap-3 px-6">
        <button onClick={() => router.push("/templates")} className="p-2 -ml-2 rounded-lg hover:bg-muted" title="Back to templates">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-base font-semibold">{templateId ? "Edit template" : "New template"}</h1>
          <p className="text-xs text-muted-foreground">
            {templateId ? "Changes need to be resubmitted to Meta" : "Saved here and submitted to Meta for approval"}
          </p>
        </div>
        <div className="flex-1" />
        {err && <span className="text-xs text-destructive mr-2">{err}</span>}
        <button className={btnGhost} onClick={() => router.push("/templates")}>Cancel</button>
        <button className={btnPri} onClick={save} disabled={saving || !draft.name.trim() || !draft.body.trim()}>
          {saving && <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />}
          {templateId ? "Save changes" : "Create template"}
        </button>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* form */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-8 space-y-7">
            {/* basics */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Basics</h2>
              <div>
                <label className={label}>Template name</label>
                <input className={clsx(input, "mt-1.5")} value={draft.name} placeholder="Diwali offer"
                  onChange={(e) => patch({ name: e.target.value })} />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Meta stores this as <code className="text-foreground">{draft.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "template_name"}</code>
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={label}>Category</label>
                  <select className={clsx(input, "mt-1.5")} value={draft.category} onChange={(e) => patch({ category: e.target.value })}>
                    <option value="MARKETING">Marketing</option>
                    <option value="UTILITY">Utility</option>
                    <option value="AUTHENTICATION">Authentication</option>
                  </select>
                </div>
                <div>
                  <label className={label}>Language</label>
                  <select className={clsx(input, "mt-1.5")} value={draft.language} onChange={(e) => patch({ language: e.target.value })}>
                    <option value="en">English</option>
                    <option value="en_US">English (US)</option>
                    <option value="hi">Hindi</option>
                  </select>
                </div>
                <div>
                  <label className={label}>Folder</label>
                  <select className={clsx(input, "mt-1.5")} value={draft.folderId} onChange={(e) => patch({ folderId: e.target.value })}>
                    <option value="">No folder</option>
                    {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={label}>Type</label>
                <div className="grid grid-cols-2 gap-3 mt-1.5">
                  {([
                    ["standard", "Standard", "Header, body, footer and buttons", ImageIcon],
                    ["carousel", "Carousel", "Up to 10 swipeable cards", GalleryHorizontalEnd],
                  ] as const).map(([v, title, desc, Icon]) => (
                    <button key={v} onClick={() => patch({ type: v })}
                      className={clsx("text-left rounded-xl border-2 p-3.5 transition-colors",
                        draft.type === v ? "border-primary bg-accent" : "hover:bg-muted/60")}>
                      <div className="flex items-center gap-2">
                        <Icon className={clsx("w-4 h-4", draft.type === v ? "text-primary" : "text-muted-foreground")} />
                        <span className="text-sm font-semibold">{title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* header */}
            {draft.type === "standard" && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Header <span className="font-normal text-muted-foreground">· optional</span></h2>
                <div className="flex flex-wrap gap-2">
                  {(["none", "text", "image", "video", "document"] as HeaderType[]).map((h) => (
                    <button key={h} onClick={() => patch({ headerType: h })}
                      className={clsx("h-8 px-3.5 rounded-full border text-xs font-medium capitalize",
                        draft.headerType === h ? "bg-accent text-accent-foreground border-primary" : "text-muted-foreground hover:bg-muted")}>
                      {h}
                    </button>
                  ))}
                </div>
                {draft.headerType === "text" && (
                  <input className={input} value={draft.headerText} placeholder="Header text"
                    onChange={(e) => patch({ headerText: e.target.value })} />
                )}
                {isMediaHeader && (
                  <MediaPicker
                    assets={assets} kind={draft.headerType} selectedId={draft.headerAssetId}
                    onSelect={(id) => patch({ headerAssetId: id })} onUploaded={loadAssets}
                  />
                )}
              </section>
            )}

            {/* body */}
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Message body</h2>
              <textarea
                ref={bodyRef}
                rows={6}
                className="w-full px-3.5 py-3 rounded-xl border bg-background text-sm outline-none focus:ring-2 focus:ring-ring resize-y leading-relaxed"
                value={draft.body}
                placeholder="Hi {{name}}, we have new launches in {{city}} starting Rs 79L."
                onChange={(e) => patch({ body: e.target.value })}
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-muted-foreground">Insert:</span>
                {TOKENS.map((tk) => (
                  <button key={tk} onClick={() => insertToken(tk)}
                    className="text-[11px] px-2 py-1 rounded-md border hover:border-primary hover:text-primary font-mono">
                    {`{{${tk}}}`}
                  </button>
                ))}
              </div>
            </section>

            {/* footer + buttons */}
            {draft.type === "standard" && (
              <>
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold">Footer <span className="font-normal text-muted-foreground">· optional</span></h2>
                  <input className={input} value={draft.footerText} placeholder="Demo Realty"
                    onChange={(e) => patch({ footerText: e.target.value })} />
                </section>

                <section className="space-y-2">
                  <h2 className="text-sm font-semibold">Buttons <span className="font-normal text-muted-foreground">· up to 3</span></h2>
                  {draft.buttons.map((b, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select className="h-10 px-2.5 rounded-lg border bg-background text-sm w-32"
                        value={b.type}
                        onChange={(e) => patch({ buttons: draft.buttons.map((x, idx) => idx === i ? { ...x, type: e.target.value as TemplateButton["type"] } : x) })}>
                        <option value="quick_reply">Quick reply</option>
                        <option value="url">Link</option>
                        <option value="phone">Call</option>
                      </select>
                      <input className="h-10 px-3 rounded-lg border bg-background text-sm flex-1" value={b.text} placeholder="Button text"
                        onChange={(e) => patch({ buttons: draft.buttons.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x) })} />
                      {b.type !== "quick_reply" && (
                        <input className="h-10 px-3 rounded-lg border bg-background text-sm flex-1" value={b.value || ""}
                          placeholder={b.type === "url" ? "https://…" : "+91…"}
                          onChange={(e) => patch({ buttons: draft.buttons.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x) })} />
                      )}
                      <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive"
                        onClick={() => patch({ buttons: draft.buttons.filter((_, idx) => idx !== i) })}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {draft.buttons.length < 3 && (
                    <button className={btnGhost} onClick={() => patch({ buttons: [...draft.buttons, { type: "quick_reply", text: "" }] })}>
                      <Plus className="w-3.5 h-3.5 inline mr-1" />Add button
                    </button>
                  )}
                </section>
              </>
            )}

            {/* carousel cards */}
            {draft.type === "carousel" && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Cards <span className="font-normal text-muted-foreground">· {draft.cards.length} of 10</span></h2>
                {draft.cards.map((c, i) => (
                  <div key={i} className="rounded-xl border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Card {i + 1}</span>
                      <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-destructive"
                        onClick={() => patch({ cards: draft.cards.filter((_, idx) => idx !== i) })}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <MediaPicker
                      assets={assets} kind="image" selectedId={c.assetId || ""}
                      onSelect={(id) => patch({ cards: draft.cards.map((x, idx) => idx === i ? { ...x, assetId: id } : x) })}
                      onUploaded={loadAssets}
                    />
                    <input className={input} value={c.body} placeholder="Card text"
                      onChange={(e) => patch({ cards: draft.cards.map((x, idx) => idx === i ? { ...x, body: e.target.value } : x) })} />
                  </div>
                ))}
                {draft.cards.length < 10 && (
                  <button className={btnGhost} onClick={() => patch({ cards: [...draft.cards, { body: "" }] })}>
                    <Plus className="w-3.5 h-3.5 inline mr-1" />Add card
                  </button>
                )}
              </section>
            )}
          </div>
        </div>

        {/* live preview */}
        <aside className="w-[380px] shrink-0 border-l bg-muted/30 overflow-y-auto hidden lg:block">
          <div className="p-6">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Preview</div>
            <div className="rounded-2xl bg-card border shadow-lg overflow-hidden">
              {draft.type === "carousel" ? (
                draft.cards.length > 0 ? (
                  <div className="flex gap-2 p-3 overflow-x-auto">
                    {draft.cards.map((c, i) => {
                      const a = assets.find((x) => x.id === c.assetId);
                      return (
                        <div key={i} className="w-40 shrink-0 rounded-xl border overflow-hidden bg-background">
                          {a ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.url} alt="" className="w-full h-24 object-cover" />
                          ) : (
                            <div className="w-full h-24 bg-muted grid place-items-center"><ImageIcon className="w-5 h-5 text-muted-foreground" /></div>
                          )}
                          <p className="text-xs p-2">{c.body || "Card text"}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-muted-foreground">Add cards to preview the carousel.</div>
                )
              ) : isMediaHeader ? (
                headerAsset && draft.headerType === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={headerAsset.url} alt="" className="w-full max-h-64 object-cover" />
                ) : (
                  <div className="w-full h-40 bg-muted grid place-items-center">
                    {draft.headerType === "video" ? <Video className="w-8 h-8 text-muted-foreground" /> : <FileText className="w-8 h-8 text-muted-foreground" />}
                  </div>
                )
              ) : null}

              <div className="p-4 space-y-2">
                {draft.headerType === "text" && draft.headerText && (
                  <p className="text-[15px] font-semibold leading-snug">{draft.headerText}</p>
                )}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {draft.body || <span className="text-muted-foreground">Your message will appear here…</span>}
                </p>
                {draft.footerText && <p className="text-[11px] text-muted-foreground pt-1">{draft.footerText}</p>}
              </div>

              {draft.type === "standard" && draft.buttons.filter((b) => b.text.trim()).length > 0 && (
                <div className="border-t divide-y">
                  {draft.buttons.filter((b) => b.text.trim()).map((b, i) => (
                    <div key={i} className="text-center text-sm text-primary py-2.5 font-medium">{b.text}</div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
              This is how the message appears on WhatsApp. Variables are replaced with each contact&apos;s details when sent.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
