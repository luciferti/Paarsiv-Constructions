"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Trash2, Upload, Video } from "lucide-react";
import { api, getSession, getToken } from "@/lib/api";
import FolderSidebar from "@/components/FolderSidebar";
import type { Asset, Folder } from "@/lib/types";

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function MediaPage() {
  const session = typeof window !== "undefined" ? getSession() : null;
  const canEdit = session?.user.role === "ADMIN" || session?.user.role === "RM";
  const [assets, setAssets] = useState<Asset[]>([]);
  const [allCount, setAllCount] = useState(0);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [active, setActive] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAssets = useCallback(() => {
    const q = active ? `?folderId=${active}` : "";
    api.get<{ assets: Asset[] }>(`/assets${q}`).then((r) => setAssets(r.assets)).catch(() => {});
  }, [active]);
  const loadAll = useCallback(() => {
    api.get<{ assets: Asset[] }>("/assets").then((r) => setAllCount(r.assets.length)).catch(() => {});
  }, []);
  const loadFolders = useCallback(() => {
    api.get<{ folders: Folder[] }>("/asset-folders").then((r) => setFolders(r.folders)).catch(() => {});
  }, []);

  useEffect(() => { loadFolders(); loadAll(); }, [loadFolders, loadAll]);
  useEffect(loadAssets, [loadAssets]);

  async function upload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    if (active) fd.append("folderId", active);
    await fetch("/api/assets", {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd,
    });
    loadAssets(); loadAll();
  }

  const headerName = active ? folders.find((f) => f.id === active)?.name || "Folder" : "All media";

  return (
    <div className="flex-1 flex min-h-0">
      <FolderSidebar
        allLabel="All media"
        allCount={allCount}
        folders={folders}
        active={active}
        onSelect={setActive}
        canEdit={!!canEdit}
        onNewFolder={(n) => api.post("/asset-folders", { name: n }).then(loadFolders)}
        onDeleteFolder={(id) => api.del(`/asset-folders/${id}`).then(() => { if (active === id) setActive(""); loadFolders(); loadAssets(); })}
      />

      <section className="flex-1 min-w-0 flex flex-col bg-background">
        <div className="px-6 py-4 border-b bg-card/50 flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold">{headerName}</h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full border text-muted-foreground">{assets.length} files</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Images, videos and documents for your messages (max 16 MB).</p>
          </div>
          <div className="flex-1" />
          {canEdit && (
            <>
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <button
                className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-3 h-3 inline mr-1.5" />Upload
              </button>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4 content-start">
          {assets.map((a) => (
            <div key={a.id} className="rounded-xl border bg-card overflow-hidden shadow-card flex flex-col">
              <div className="h-28 bg-muted grid place-items-center overflow-hidden">
                {a.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.originalName} className="w-full h-full object-cover" />
                ) : a.mimeType.startsWith("video/") ? (
                  <Video className="w-8 h-8 text-muted-foreground" />
                ) : (
                  <FileText className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div className="px-3 pt-2 text-xs font-medium truncate" title={a.originalName}>{a.originalName}</div>
              <div className="px-3 pb-2 text-[11px] text-muted-foreground">{fmtSize(a.size)}</div>
              {canEdit && (
                <div className="px-3 py-2 border-t flex items-center gap-2">
                  <select
                    className="flex-1 h-7 px-1.5 rounded-md border bg-background text-[11px]"
                    value={a.folderId || ""}
                    onChange={(e) => api.patch(`/assets/${a.id}`, { folderId: e.target.value }).then(loadAssets)}
                  >
                    <option value="">No folder</option>
                    {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <Trash2
                    className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive cursor-pointer"
                    onClick={() => api.del(`/assets/${a.id}`).then(() => { loadAssets(); loadAll(); })}
                  />
                </div>
              )}
            </div>
          ))}
          {assets.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full">No files here. Upload one to get started.</p>
          )}
        </div>
      </section>
    </div>
  );
}
