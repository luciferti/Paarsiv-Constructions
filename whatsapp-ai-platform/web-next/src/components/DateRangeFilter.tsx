"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarRange, Check, ChevronDown } from "lucide-react";
import clsx from "clsx";

export interface DateRange {
  preset: string;      // "all" | "today" | "7d" | "30d" | "90d" | "custom"
  from?: string;       // ISO date (yyyy-mm-dd)
  to?: string;
}

export const DEFAULT_RANGE: DateRange = { preset: "30d" };

const PRESETS: { v: string; label: string; days?: number }[] = [
  { v: "today", label: "Today", days: 0 },
  { v: "7d", label: "Last 7 days", days: 7 },
  { v: "30d", label: "Last 30 days", days: 30 },
  { v: "90d", label: "Last 90 days", days: 90 },
  { v: "all", label: "All time" },
];

/** Local calendar day as yyyy-mm-dd (toISOString would shift by timezone). */
function isoDay(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Resolve a range into concrete from/to dates (undefined = unbounded). */
export function resolveRange(r: DateRange): { from?: string; to?: string } {
  if (r.preset === "all") return {};
  if (r.preset === "custom") return { from: r.from, to: r.to };
  const p = PRESETS.find((x) => x.v === r.preset);
  if (!p || p.days === undefined) return {};
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - p.days);
  from.setHours(0, 0, 0, 0);
  return { from: isoDay(from), to: isoDay(to) };
}

/** Build the `?from=&to=` query fragment for API calls. */
export function rangeQuery(r: DateRange): string {
  const { from, to } = resolveRange(r);
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  const s = p.toString();
  return s ? `&${s}` : "";
}

export function rangeLabel(r: DateRange): string {
  if (r.preset === "custom") {
    if (r.from && r.to) return `${r.from} → ${r.to}`;
    return "Custom range";
  }
  return PRESETS.find((p) => p.v === r.preset)?.label || "Last 30 days";
}

/** Compact date-range picker used across dashboard, reports and list pages. */
export default function DateRangeFilter({
  value, onChange, className,
}: { value: DateRange; onChange: (r: DateRange) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from || "");
  const [to, setTo] = useState(value.to || "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className={clsx("relative", className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="h-9 px-3 rounded-lg border bg-card text-sm font-medium hover:bg-muted inline-flex items-center gap-2"
      >
        <CalendarRange className="w-4 h-4 text-muted-foreground" />
        {rangeLabel(value)}
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border bg-card shadow-lg z-30 overflow-hidden">
          {PRESETS.map((p) => (
            <button
              key={p.v}
              onClick={() => { onChange({ preset: p.v }); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3.5 py-2 text-sm hover:bg-muted text-left"
            >
              <span className="flex-1">{p.label}</span>
              {value.preset === p.v && <Check className="w-3.5 h-3.5 text-primary" />}
            </button>
          ))}
          <div className="border-t p-3 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Custom range</div>
            <div className="flex items-center gap-1.5">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="flex-1 h-8 px-2 rounded-lg border bg-background text-xs" />
              <span className="text-xs text-muted-foreground">→</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="flex-1 h-8 px-2 rounded-lg border bg-background text-xs" />
            </div>
            <button
              disabled={!from || !to}
              onClick={() => { onChange({ preset: "custom", from, to }); setOpen(false); }}
              className="w-full h-8 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
