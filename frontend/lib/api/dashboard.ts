import { apiRequest } from "@/lib/api/client";
import { DashboardSummary } from "@/lib/types/dashboard";

export function getDashboardSummary(): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>("/dashboard/summary");
}
