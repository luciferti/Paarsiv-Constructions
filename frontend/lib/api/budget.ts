import { apiRequest } from "@/lib/api/client";
import { BudgetLine, BudgetLineFormValues, SiteBudgetSummary } from "@/lib/types/budget";

export function getSiteBudgetSummary(siteId: string): Promise<SiteBudgetSummary> {
  return apiRequest<SiteBudgetSummary>(`/sites/${siteId}/budget/summary`);
}

export function listSiteBudgetLines(siteId: string): Promise<BudgetLine[]> {
  return apiRequest<BudgetLine[]>(`/sites/${siteId}/budget/lines`);
}

export function addSiteBudgetLine(
  siteId: string,
  payload: BudgetLineFormValues
): Promise<BudgetLine> {
  return apiRequest<BudgetLine>(`/sites/${siteId}/budget/lines`, { method: "POST", body: payload });
}

export function deleteSiteBudgetLine(siteId: string, lineId: string): Promise<void> {
  return apiRequest<void>(`/sites/${siteId}/budget/lines/${lineId}`, { method: "DELETE" });
}
