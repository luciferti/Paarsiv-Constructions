import { apiRequest } from "@/lib/api/client";
import { DailyReport, DailyReportFormValues } from "@/lib/types/report";

export function listSiteReports(siteId: string): Promise<DailyReport[]> {
  return apiRequest<DailyReport[]>(`/sites/${siteId}/reports`);
}

export function createSiteReport(
  siteId: string,
  payload: DailyReportFormValues
): Promise<DailyReport> {
  return apiRequest<DailyReport>(`/sites/${siteId}/reports`, { method: "POST", body: payload });
}

export function updateSiteReport(
  siteId: string,
  reportId: string,
  payload: Partial<DailyReportFormValues>
): Promise<DailyReport> {
  return apiRequest<DailyReport>(`/sites/${siteId}/reports/${reportId}`, {
    method: "PATCH",
    body: payload,
  });
}
