import { apiRequest } from "@/lib/api/client";
import {
  AttendanceEntry,
  AttendanceFormValues,
  PaginatedWorkers,
  SiteLabourSummaryItem,
  Worker,
  WorkerFormValues,
  WorkerStatus,
} from "@/lib/types/labour";

export function listWorkers(params: {
  page?: number;
  pageSize?: number;
  status?: WorkerStatus;
}): Promise<PaginatedWorkers> {
  return apiRequest<PaginatedWorkers>("/workers", {
    query: { page: params.page ?? 1, page_size: params.pageSize ?? 20, status: params.status },
  });
}

export function getWorker(workerId: string): Promise<Worker> {
  return apiRequest<Worker>(`/workers/${workerId}`);
}

export function createWorker(payload: WorkerFormValues): Promise<Worker> {
  return apiRequest<Worker>("/workers", { method: "POST", body: payload });
}

export function updateWorker(
  workerId: string,
  payload: Partial<WorkerFormValues>
): Promise<Worker> {
  return apiRequest<Worker>(`/workers/${workerId}`, { method: "PATCH", body: payload });
}

export function archiveWorker(workerId: string): Promise<void> {
  return apiRequest<void>(`/workers/${workerId}`, { method: "DELETE" });
}

export function getSiteLabourSummary(
  siteId: string,
  range?: { from?: string; to?: string }
): Promise<SiteLabourSummaryItem[]> {
  return apiRequest<SiteLabourSummaryItem[]>(`/sites/${siteId}/labour/summary`, {
    query: { from: range?.from, to: range?.to },
  });
}

export function listSiteAttendance(siteId: string, date?: string): Promise<AttendanceEntry[]> {
  return apiRequest<AttendanceEntry[]>(`/sites/${siteId}/labour/attendance`, {
    query: { date },
  });
}

export function markSiteAttendance(
  siteId: string,
  payload: AttendanceFormValues
): Promise<AttendanceEntry> {
  return apiRequest<AttendanceEntry>(`/sites/${siteId}/labour/attendance`, {
    method: "POST",
    body: payload,
  });
}
