"use client";

import { Folder as FolderIcon, FolderPlus, Layers, X } from "lucide-react";
import clsx from "clsx";
import type { Folder } from "@/lib/types";

interface Props {
  allLabel: string;
  allCount: number;
  folders: (Folder & { count?: number })[];
  active: string; // "" = all
  onSelect: (id: string) => void;
  canEdit: boolean;
  onNewFolder: (name: string) => void;
  onDeleteFolder: (id: string) => void;
  footer?: React.ReactNode;
}

/** Left rail with an "all" row plus flat folders — used by Templates and Media. */
export default function FolderSidebar({
  allLabel, allCount, folders, active, onSelect, canEdit, onNewFolder, onDeleteFolder, footer,
}: Props) {
  return (
    <aside className="w-60 shrink-0 border-r bg-card flex flex-col p-2.5 min-h-0">
      <button
        onClick={() => onSelect("")}
        className={clsx(
          "flex items-center gap-2 h-9 px-3 rounded-lg text-[13px]",
          active === "" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-muted"
        )}
      >
        <Layers className="w-4 h-4" />
        <span className="flex-1 text-left">{allLabel}</span>
        <span className="text-[11px]">{allCount}</span>
      </button>

      <div className="flex items-center justify-between px-3 pt-4 pb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Folders</span>
        {canEdit && (
          <FolderPlus
            className="w-4 h-4 cursor-pointer text-muted-foreground hover:text-primary"
            onClick={() => { const n = prompt("Folder name:"); if (n?.trim()) onNewFolder(n.trim()); }}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-0.5">
        {folders.map((f) => (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className={clsx(
              "w-full flex items-center gap-2 h-8 px-3 rounded-lg text-[13px] group",
              active === f.id ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <FolderIcon className="w-3.5 h-3.5" />
            <span className="flex-1 truncate text-left">{f.name}</span>
            {f.count !== undefined && <span className="text-[11px]">{f.count}</span>}
            {canEdit && (
              <X
                className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDeleteFolder(f.id); }}
              />
            )}
          </button>
        ))}
        {folders.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No folders yet.</p>}
      </div>

      {footer && <div className="border-t pt-2">{footer}</div>}
    </aside>
  );
}
