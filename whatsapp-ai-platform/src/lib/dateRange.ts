import type { Request } from "express";

export interface DateRange {
  from?: Date;
  to?: Date;
}

/**
 * Parse `?from=YYYY-MM-DD&to=YYYY-MM-DD` into a range. `to` is pushed to the
 * end of that day so a single-day range includes the whole day.
 */
export function parseRange(req: Request): DateRange {
  const raw = (k: string) => (typeof req.query[k] === "string" ? (req.query[k] as string) : "");
  const range: DateRange = {};

  const f = raw("from");
  if (f) {
    const d = new Date(f);
    if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); range.from = d; }
  }
  const t = raw("to");
  if (t) {
    const d = new Date(t);
    if (!isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); range.to = d; }
  }
  return range;
}

/** Prisma filter for a date column, or undefined when the range is unbounded. */
export function dateFilter(r: DateRange) {
  if (!r.from && !r.to) return undefined;
  return { ...(r.from ? { gte: r.from } : {}), ...(r.to ? { lte: r.to } : {}) };
}
