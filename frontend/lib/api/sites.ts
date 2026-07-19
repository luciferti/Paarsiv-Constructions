import { apiRequest } from "@/lib/api/client";
import {
  PaginatedSites,
  Site,
  SiteFormValues,
  SiteStatus,
  SiteTeamMember,
} from "@/lib/types/site";

export function listSites(params: {
  page?: number;
  pageSize?: number;
  status?: SiteStatus;
  projectId?: string;
}): Promise<PaginatedSites> {
  return apiRequest<PaginatedSites>("/sites", {
    query: {
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20,
      status: params.status,
      project_id: params.projectId,
    },
  });
}

export function getSite(siteId: string): Promise<Site> {
  return apiRequest<Site>(`/sites/${siteId}`);
}

export function createSite(payload: SiteFormValues): Promise<Site> {
  return apiRequest<Site>("/sites", { method: "POST", body: payload });
}

export function updateSite(siteId: string, payload: Partial<SiteFormValues>): Promise<Site> {
  return apiRequest<Site>(`/sites/${siteId}`, { method: "PATCH", body: payload });
}

export function archiveSite(siteId: string): Promise<void> {
  return apiRequest<void>(`/sites/${siteId}`, { method: "DELETE" });
}

export function listTeamMembers(siteId: string): Promise<SiteTeamMember[]> {
  return apiRequest<SiteTeamMember[]>(`/sites/${siteId}/team`);
}

export function addTeamMember(
  siteId: string,
  payload: { employee_id: string; role_on_site: string }
): Promise<SiteTeamMember> {
  return apiRequest<SiteTeamMember>(`/sites/${siteId}/team`, { method: "POST", body: payload });
}

export function removeTeamMember(siteId: string, employeeId: string): Promise<void> {
  return apiRequest<void>(`/sites/${siteId}/team/${employeeId}`, { method: "DELETE" });
}
