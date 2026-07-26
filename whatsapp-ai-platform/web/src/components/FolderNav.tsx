import type { Folder } from "../types";

interface Props {
  allLabel: string;
  allCount: number;
  folders: (Folder & { count?: number })[];
  activeFolderId: string; // "" = all
  onSelect: (id: string) => void;
  canEdit: boolean;
  onNewFolder: (name: string) => void;
  onDeleteFolder: (id: string) => void;
  sectionLabel?: string;
  footer?: React.ReactNode;
}

/** Left sidebar listing an "all" row + folders. Selecting filters the main view. */
export default function FolderNav({
  allLabel, allCount, folders, activeFolderId, onSelect,
  canEdit, onNewFolder, onDeleteFolder, sectionLabel = "Folders", footer,
}: Props) {
  return (
    <aside className="side">
      <div className={`side-item ${activeFolderId === "" ? "sel" : ""}`} onClick={() => onSelect("")}>
        <i className="ti ti-stack-2" />
        <span className="side-label" style={{ fontWeight: 500 }}>{allLabel}</span>
        <span className="side-count">{allCount}</span>
      </div>

      <div className="side-section">
        <span>{sectionLabel}</span>
        {canEdit && (
          <span className="side-actions">
            <i className="ti ti-folder-plus" title="New folder" onClick={() => { const n = prompt("Folder name:"); if (n && n.trim()) onNewFolder(n.trim()); }} />
          </span>
        )}
      </div>

      <div className="side-scroll">
        {folders.map((f) => (
          <div key={f.id} className={`side-folder ${activeFolderId === f.id ? "sel" : ""}`} onClick={() => onSelect(f.id)}>
            <i className="ti ti-folder" />
            <span className="side-label">{f.name}</span>
            {f.count !== undefined && <span className="side-count">{f.count}</span>}
            {canEdit && <i className="ti ti-x side-del" title="Delete folder" onClick={(e) => { e.stopPropagation(); onDeleteFolder(f.id); }} />}
          </div>
        ))}
        {folders.length === 0 && <div className="side-empty">No folders yet.</div>}
      </div>

      {footer && <div className="side-foot">{footer}</div>}
    </aside>
  );
}
