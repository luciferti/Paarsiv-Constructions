"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

export interface PageMeta {
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export const EMPTY_PAGE: PageMeta = { total: 0, page: 1, pageSize: 25, pages: 1 };

interface Props {
  meta: PageMeta;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  label?: string; // e.g. "contacts"
  className?: string;
}

const SIZES = [10, 25, 50, 100];

/** Compact page numbers with ellipses: 1 … 4 5 6 … 20 */
function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) out.push("…");
  for (let i = from; i <= to; i++) out.push(i);
  if (to < total - 1) out.push("…");
  out.push(total);
  return out;
}

/** Shared pager used by every list in the app. */
export default function Pagination({ meta, onPage, onPageSize, label = "items", className }: Props) {
  if (meta.total === 0) return null;
  const first = (meta.page - 1) * meta.pageSize + 1;
  const last = Math.min(meta.total, meta.page * meta.pageSize);

  return (
    <div className={clsx("flex items-center gap-3 flex-wrap text-sm", className)}>
      <span className="text-xs text-muted-foreground">
        {first}–{last} of {meta.total} {label}
      </span>

      {onPageSize && (
        <select
          value={meta.pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="h-8 px-2 rounded-lg border bg-background text-xs"
          title="Rows per page"
        >
          {SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
        </select>
      )}

      <div className="flex-1" />

      {meta.pages > 1 && (
        <div className="flex items-center gap-1">
          <button
            disabled={meta.page <= 1}
            onClick={() => onPage(meta.page - 1)}
            className="h-8 w-8 grid place-items-center rounded-lg border disabled:opacity-40 hover:bg-muted"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {pageList(meta.page, meta.pages).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1.5 text-xs text-muted-foreground">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p)}
                className={clsx(
                  "h-8 min-w-8 px-2 rounded-lg text-xs font-medium border",
                  p === meta.page ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                )}
              >
                {p}
              </button>
            )
          )}

          <button
            disabled={meta.page >= meta.pages}
            onClick={() => onPage(meta.page + 1)}
            className="h-8 w-8 grid place-items-center rounded-lg border disabled:opacity-40 hover:bg-muted"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
