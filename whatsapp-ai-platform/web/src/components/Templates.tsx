import { useEffect, useState } from "react";
import { api } from "../api";
import FolderNav from "./FolderNav";
import type { Asset, Folder, Template, TemplateButton, TemplateCard, User } from "../types";

type Draft = {
  id?: string;
  name: string; category: string; folderId: string;
  type: "standard" | "carousel";
  headerType: "none" | "text" | "image" | "video" | "document";
  headerText: string; headerAssetId: string;
  body: string; footerText: string;
  buttons: TemplateButton[]; cards: TemplateCard[];
};

const emptyDraft: Draft = {
  name: "", category: "MARKETING", folderId: "", type: "standard",
  headerType: "none", headerText: "", headerAssetId: "",
  body: "", footerText: "", buttons: [], cards: [],
};

export default function Templates({ me }: { me: User }) {
  const canEdit = me.role === "ADMIN" || me.role === "RM";
  const [templates, setTemplates] = useState<Template[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [active, setActive] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function loadTemplates() { api.get<{ templates: Template[] }>("/templates").then((r) => setTemplates(r.templates)).catch(() => {}); }
  function loadFolders() { api.get<{ folders: Folder[] }>("/template-folders").then((r) => setFolders(r.folders)).catch(() => {}); }
  function loadAssets() { api.get<{ assets: Asset[] }>("/assets").then((r) => setAssets(r.assets)).catch(() => {}); }
  useEffect(() => { loadTemplates(); loadFolders(); loadAssets(); }, []);

  const shown = templates.filter((t) => (active ? t.folderId === active : true));
  const counts = new Map<string, number>();
  for (const t of templates) if (t.folderId) counts.set(t.folderId, (counts.get(t.folderId) || 0) + 1);
  const foldersWithCounts = folders.map((f) => ({ ...f, count: counts.get(f.id) || 0 }));

  function openNew() { setErr(null); setDraft({ ...emptyDraft, folderId: active }); }
  function openEdit(t: Template) {
    setErr(null);
    setDraft({
      id: t.id, name: t.name, category: t.category, folderId: t.folderId || "",
      type: t.type, headerType: t.headerType, headerText: t.headerText || "", headerAssetId: t.headerAssetId || "",
      body: t.body, footerText: t.footerText || "", buttons: t.buttons || [], cards: t.cards || [],
    });
  }
  function patch(p: Partial<Draft>) { setDraft((d) => (d ? { ...d, ...p } : d)); }

  async function save() {
    if (!draft) return;
    setErr(null);
    if (!draft.name.trim() || !draft.body.trim()) { setErr("Name and body are required"); return; }
    const payload = {
      name: draft.name.trim(), category: draft.category, folderId: draft.folderId || null,
      type: draft.type, headerType: draft.type === "carousel" ? "none" : draft.headerType,
      headerText: draft.headerType === "text" ? draft.headerText : undefined,
      headerAssetId: ["image", "video", "document"].includes(draft.headerType) ? (draft.headerAssetId || undefined) : undefined,
      body: draft.body, footerText: draft.footerText || undefined,
      buttons: draft.type === "standard" ? draft.buttons : [], cards: draft.type === "carousel" ? draft.cards : [],
    };
    try {
      if (draft.id) await api.patch(`/templates/${draft.id}`, payload);
      else await api.post("/templates", payload);
      setDraft(null); loadTemplates(); loadFolders();
    } catch (e: any) { setErr(e?.message || "Failed"); }
  }

  const mediaAssets = assets;

  return (
    <div className="contacts-layout">
      <FolderNav
        allLabel="All templates" allCount={templates.length} folders={foldersWithCounts} activeFolderId={active}
        onSelect={setActive} canEdit={canEdit}
        onNewFolder={(n) => api.post("/template-folders", { name: n }).then(loadFolders)}
        onDeleteFolder={(id) => api.del(`/template-folders/${id}`).then(() => { if (active === id) setActive(""); loadFolders(); loadTemplates(); })}
      />

      <section className="main">
        <div className="main-head">
          <div>
            <div className="main-title"><span>{active ? folders.find((f) => f.id === active)?.name || "Folder" : "All templates"}</span><span className="pill-count">{shown.length}</span></div>
            <div className="main-desc">Reusable messages. Use {"{{name}}"}, {"{{city}}"} to personalize.</div>
          </div>
          <div style={{ flex: 1 }} />
          {canEdit && <button className="btn small" onClick={openNew}>+ New template</button>}
        </div>

        <div className="table-wrap">
          <div className="tpl-grid">
            {shown.map((t) => (
              <div className="tpl-card" key={t.id}>
                <div className="tpl-head">
                  <span className="tpl-name">{t.name}</span>
                  <span className="mini ai">{t.category.toLowerCase()}</span>
                </div>
                {t.type === "carousel" ? (
                  <div className="tpl-badge-row"><span className="mini human"><i className="ti ti-carousel-horizontal" /> carousel · {t.cards.length} cards</span></div>
                ) : t.headerType !== "none" && (
                  <div className="tpl-badge-row"><span className="mini assignee"><i className={`ti ${t.headerType === "text" ? "ti-heading" : "ti-photo"}`} /> {t.headerType} header</span></div>
                )}
                <div className="tpl-body">{t.body}</div>
                {t.footerText && <div className="tpl-footer">{t.footerText}</div>}
                {t.buttons?.length > 0 && (
                  <div className="tpl-btns">{t.buttons.map((b, i) => <span key={i} className="tpl-btn"><i className="ti ti-square-rounded" />{b.text}</span>)}</div>
                )}
                <div className="tpl-meta">
                  {t.tokens.map((tk) => <span key={tk} className="mini assignee">{`{{${tk}}}`}</span>)}
                  {canEdit && <button className="tpl-del" onClick={() => openEdit(t)}>Edit</button>}
                  {canEdit && <button className="tpl-del" onClick={() => api.del(`/templates/${t.id}`).then(loadTemplates)}>Delete</button>}
                </div>
              </div>
            ))}
            {shown.length === 0 && <div className="side-empty">No templates here yet.</div>}
          </div>
        </div>
      </section>

      {/* Builder drawer */}
      {draft && (
        <div className="drawer-scrim" onClick={() => setDraft(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head"><span>{draft.id ? "Edit template" : "New template"}</span><i className="ti ti-x" onClick={() => setDraft(null)} /></div>
            <div className="drawer-body">
              <label className="fl">Name</label>
              <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Welcome offer" />

              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label className="fl">Category</label>
                  <select value={draft.category} onChange={(e) => patch({ category: e.target.value })}>
                    <option value="MARKETING">Marketing</option><option value="UTILITY">Utility</option><option value="AUTHENTICATION">Authentication</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="fl">Folder</label>
                  <select value={draft.folderId} onChange={(e) => patch({ folderId: e.target.value })}>
                    <option value="">No folder</option>
                    {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>

              <label className="fl">Type</label>
              <div className="seg-toggle">
                <button className={draft.type === "standard" ? "on" : ""} onClick={() => patch({ type: "standard" })}>Standard</button>
                <button className={draft.type === "carousel" ? "on" : ""} onClick={() => patch({ type: "carousel" })}>Carousel</button>
              </div>

              {draft.type === "standard" && (
                <>
                  <label className="fl">Header</label>
                  <select value={draft.headerType} onChange={(e) => patch({ headerType: e.target.value as Draft["headerType"] })}>
                    <option value="none">None</option><option value="text">Text</option>
                    <option value="image">Image</option><option value="video">Video</option><option value="document">Document</option>
                  </select>
                  {draft.headerType === "text" && <input value={draft.headerText} onChange={(e) => patch({ headerText: e.target.value })} placeholder="Header text" />}
                  {["image", "video", "document"].includes(draft.headerType) && (
                    <select value={draft.headerAssetId} onChange={(e) => patch({ headerAssetId: e.target.value })}>
                      <option value="">— pick from media library —</option>
                      {mediaAssets.map((a) => <option key={a.id} value={a.id}>{a.originalName}</option>)}
                    </select>
                  )}
                </>
              )}

              <label className="fl">Body</label>
              <textarea rows={4} value={draft.body} onChange={(e) => patch({ body: e.target.value })} placeholder="Hi {{name}}, we have new launches in {{city}}!" style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, resize: "vertical" }} />

              {draft.type === "standard" && (
                <>
                  <label className="fl">Footer</label>
                  <input value={draft.footerText} onChange={(e) => patch({ footerText: e.target.value })} placeholder="Optional" />

                  <label className="fl">Buttons</label>
                  {draft.buttons.map((b, i) => (
                    <div className="cond-row" key={i}>
                      <select value={b.type} onChange={(e) => patch({ buttons: draft.buttons.map((x, idx) => idx === i ? { ...x, type: e.target.value as any } : x) })}>
                        <option value="quick_reply">Quick reply</option><option value="url">Link</option><option value="phone">Call</option>
                      </select>
                      <input value={b.text} placeholder="Button text" onChange={(e) => patch({ buttons: draft.buttons.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x) })} />
                      {b.type !== "quick_reply" && <input value={b.value || ""} placeholder={b.type === "url" ? "https://…" : "+91…"} onChange={(e) => patch({ buttons: draft.buttons.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x) })} />}
                      <button className="btn small ghost" onClick={() => patch({ buttons: draft.buttons.filter((_, idx) => idx !== i) })}>×</button>
                    </div>
                  ))}
                  {draft.buttons.length < 3 && <button className="btn small ghost" onClick={() => patch({ buttons: [...draft.buttons, { type: "quick_reply", text: "" }] })}>+ button</button>}
                </>
              )}

              {draft.type === "carousel" && (
                <>
                  <label className="fl">Cards ({draft.cards.length})</label>
                  {draft.cards.map((c, i) => (
                    <div className="card-edit" key={i}>
                      <div className="card-edit-head"><span>Card {i + 1}</span><i className="ti ti-x" onClick={() => patch({ cards: draft.cards.filter((_, idx) => idx !== i) })} /></div>
                      <select value={c.assetId || ""} onChange={(e) => patch({ cards: draft.cards.map((x, idx) => idx === i ? { ...x, assetId: e.target.value } : x) })}>
                        <option value="">— card image —</option>
                        {mediaAssets.map((a) => <option key={a.id} value={a.id}>{a.originalName}</option>)}
                      </select>
                      <input value={c.body} placeholder="Card text" onChange={(e) => patch({ cards: draft.cards.map((x, idx) => idx === i ? { ...x, body: e.target.value } : x) })} />
                    </div>
                  ))}
                  {draft.cards.length < 10 && <button className="btn small ghost" onClick={() => patch({ cards: [...draft.cards, { body: "" }] })}>+ card</button>}
                </>
              )}

              {err && <p className="err">{err}</p>}
            </div>
            <div className="drawer-foot">
              {draft.id && <button className="btn small danger" onClick={() => api.del(`/templates/${draft.id}`).then(() => { setDraft(null); loadTemplates(); })}>Delete</button>}
              <div style={{ flex: 1 }} />
              <button className="btn small ghost" onClick={() => setDraft(null)}>Cancel</button>
              <button className="btn small" onClick={save} disabled={!draft.name.trim()}>{draft.id ? "Save" : "Create"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
