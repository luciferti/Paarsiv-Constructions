import { apiRequest } from "@/lib/api/client";
import {
  Incident,
  IncidentFormValues,
  IncidentSeverity,
  IncidentStatus,
  PaginatedIncidents,
  SafetySummary,
} from "@/lib/types/safety";

export function listIncidents(params: {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  siteId?: string;
}): Promise<PaginatedIncidents> {
  return apiRequest<PaginatedIncidents>("/incidents", {
    query: { status: params.status, severity: params.severity, site_id: params.siteId, page_size: 100 },
  });
}

export function getSafetySummary(siteId?: string): Promise<SafetySummary> {
  return apiRequest<SafetySummary>("/incidents/summary", { query: { site_id: siteId } });
}

export function getIncident(id: string): Promise<Incident> {
  return apiRequest<Incident>(`/incidents/${id}`);
}

export function createIncident(payload: IncidentFormValues): Promise<Incident> {
  return apiRequest<Incident>("/incidents", { method: "POST", body: payload });
}

export function updateIncident(
  id: string,
  payload: { status?: IncidentStatus; action_taken?: string | null }
): Promise<Incident> {
  return apiRequest<Incident>(`/incidents/${id}`, { method: "PATCH", body: payload });
}

export function deleteIncident(id: string): Promise<void> {
  return apiRequest<void>(`/incidents/${id}`, { method: "DELETE" });
}
