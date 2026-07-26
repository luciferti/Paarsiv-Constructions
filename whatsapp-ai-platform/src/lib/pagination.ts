import type { Request } from "express";

export interface Paging {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

const MAX_PAGE_SIZE = 200;

/**
 * Parse `?page=1&pageSize=25` with sane bounds. Lists stay usable at any size
 * because pageSize is capped.
 */
export function parsePaging(req: Request, defaultSize = 25): Paging {
  const page = Math.max(1, Number(req.query.page) || 1);
  const requested = Number(req.query.pageSize) || defaultSize;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requested));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/** Standard meta block returned alongside every paginated list. */
export function pageMeta(total: number, p: Paging) {
  return {
    total,
    page: p.page,
    pageSize: p.pageSize,
    pages: Math.max(1, Math.ceil(total / p.pageSize)),
  };
}
