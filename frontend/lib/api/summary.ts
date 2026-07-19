import { apiRequest } from "@/lib/api/client";
import { SiteAISummary } from "@/lib/types/summary";

export function getSiteSummary(siteId: string): Promise<SiteAISummary> {
  return apiRequest<SiteAISummary>(`/sites/${siteId}/ai-summary`);
}

export function generateSiteSummary(siteId: string): Promise<SiteAISummary> {
  return apiRequest<SiteAISummary>(`/sites/${siteId}/ai-summary`, { method: "POST" });
}
