import { apiRequest } from "@/lib/api/client";

export interface SeedResult {
  seeded: boolean;
  reason?: string;
  [key: string]: unknown;
}

/** Loads a realistic sample dataset into the current org (idempotent). */
export function seedDemoData(): Promise<SeedResult> {
  return apiRequest<SeedResult>("/demo/seed", { method: "POST" });
}
