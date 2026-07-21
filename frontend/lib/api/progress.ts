import { apiRequest } from "@/lib/api/client";
import {
  Milestone,
  MilestoneFormValues,
  MilestoneStatus,
  SiteProgressSummary,
} from "@/lib/types/progress";

export function getSiteProgress(siteId: string): Promise<SiteProgressSummary> {
  return apiRequest<SiteProgressSummary>(`/sites/${siteId}/milestones/summary`);
}

export function addMilestone(siteId: string, payload: MilestoneFormValues): Promise<Milestone> {
  return apiRequest<Milestone>(`/sites/${siteId}/milestones`, { method: "POST", body: payload });
}

export function updateMilestone(
  siteId: string,
  milestoneId: string,
  payload: { progress_percent?: number; status?: MilestoneStatus; actual_date?: string | null; target_date?: string | null }
): Promise<Milestone> {
  return apiRequest<Milestone>(`/sites/${siteId}/milestones/${milestoneId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteMilestone(siteId: string, milestoneId: string): Promise<void> {
  return apiRequest<void>(`/sites/${siteId}/milestones/${milestoneId}`, { method: "DELETE" });
}
