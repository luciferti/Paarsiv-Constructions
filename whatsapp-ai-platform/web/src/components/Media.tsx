import { useEffect, useRef, useState } from "react";
import { api, getToken } from "../api";
import FolderNav from "./FolderNav";
import type { Asset, Folder, User } from "../types";

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
function isImage(m: string) { return m.startsWith("image/"); }
function isVideo(m: string) { return m.startsWith("video/"); }

export default function Media({ me }: { me: User }) {
  const canEdit = me.role === "ADMIN" || me.role === "RM";
  const [assets, setAssets] = useState<Asset[]>([]);
  const [allCount, setAllCount] = useState(0);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [active, setActive] = useState(""); // "" = all
  const fileRef = useRef<HTMLInputElement>(null);

  function loadAssets() {
    const q = active ? `?folderId=${active}` : "";
    api.get<{ assets: Asset[] }>(`/assets${q}`).then((r) => setAssets(r.assets)).catch(() => {});
  }
  function loadAll() { api.get<{ assets: Asset[] }>("/assets").then((r) => setAllCount(r.assets.length)).catch(() => {}); }
  function loadFolders() { api.get<{ folders: Folder[] }>("/asset-folders").then((r) => setFolders(r.folders)).catch(() => {}); }

  useEffect(() => { loadFolders(); loadAll(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadAssets, [active]);

  async function upload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    if (active) fd.append("folderId", active);
    await fetch("/api/assets", { method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
    loadAssets(); loadAll();
  }
  async function del(id: string) { await api.del(`/assets/${id}`); loadAssets(); loadAll(); }
  async function move(id: string, folderId: string) { await api.patch(`/assets/${id}`, { folderId }); loadAssets(); }
  function newFolder(name: string) { api.post("/asset-folders", { name }).then(loadFolders); }
  function delFolder(id: string) { api.del(`/asset-folders/${id}`).then(() => { if (active === id) setActive(""); loadFolders(); loadAssets(); }); }

  const headerName = active ? folders.find((f) => f.id === active)?.name || "Folder" : "All media";

  return (
    <div className="contacts-layout">
      <FolderNav
        allLabel="All media" allCount={allCount} folders={folders} activeFolderId={active}
        onSelect={setActive} canEdit={canEdit} onNewFolder={newFolder} onDeleteFolder={delFolder}
        sectionLabel="Folders"
      />
      <section className="main">
        <div className="main-head">
          <div>
            <div className="main-title"><span>{headerName}</span><span className="pill-count">{assets.length} files</span></div>
            <div className="main-desc">Images, videos and documents for your messages (max 16 MB).</div>
          </div>
          <div style={{ flex: 1 }} />
          {canEdit && (
            <>
              <input ref={fileRef} type="file" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <button className="btn small" onClick={() => fileRef.current?.click()}>↑ Upload</button>
            </>
          )}
        </div>

        <div className="media-grid">
          {assets.map((a) => (
            <div className="media-card" key={a.id}>
              <div className="media-thumb">
                {isImage(a.mimeType) ? <img src={a.url} alt={a.originalName} />
                  : isVideo(a.mimeType) ? <i className="ti ti-video" />
                  : <i className="ti ti-file" />}
              </div>
              <div className="media-name" title={a.originalName}>{a.originalName}</div>
              <div className="media-meta">{fmtSize(a.size)}</div>
              {canEdit && (
                <div className="media-actions">
                  <select value={a.folderId || ""} onChange={(e) => move(a.id, e.target.value)} title="Move to folder">
                    <option value="">No folder</option>
                    {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <i className="ti ti-trash" title="Delete" onClick={() => del(a.id)} />
                </div>
              )}
            </div>
          ))}
          {assets.length === 0 && <div className="side-empty">No files here. Upload one to get started.</div>}
        </div>
      </section>
    </div>
  );
}
