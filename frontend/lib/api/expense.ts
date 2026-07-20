import { apiRequest } from "@/lib/api/client";
import { CashEntry, CashEntryFormValues, PettyCashSummary } from "@/lib/types/expense";

export function getPettyCashSummary(siteId?: string): Promise<PettyCashSummary> {
  return apiRequest<PettyCashSummary>("/petty-cash/summary", {
    query: { site_id: siteId },
  });
}

export function listCashEntries(siteId?: string): Promise<CashEntry[]> {
  return apiRequest<CashEntry[]>("/petty-cash/entries", { query: { site_id: siteId } });
}

export function addCashEntry(payload: CashEntryFormValues): Promise<CashEntry> {
  return apiRequest<CashEntry>("/petty-cash/entries", { method: "POST", body: payload });
}

export function deleteCashEntry(entryId: string): Promise<void> {
  return apiRequest<void>(`/petty-cash/entries/${entryId}`, { method: "DELETE" });
}
