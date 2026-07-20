import { apiRequest } from "@/lib/api/client";
import {
  PaginatedSubcontractors,
  PaginatedWorkOrders,
  Subcontractor,
  SubcontractorFormValues,
  SubcontractorStatus,
  WorkOrder,
  WorkOrderFormValues,
  WorkOrderStatus,
} from "@/lib/types/subcontract";

// ---- Subcontractors ----

export function listSubcontractors(params: {
  status?: SubcontractorStatus;
  pageSize?: number;
}): Promise<PaginatedSubcontractors> {
  return apiRequest<PaginatedSubcontractors>("/subcontractors", {
    query: { status: params.status, page_size: params.pageSize ?? 100 },
  });
}

export function getSubcontractor(id: string): Promise<Subcontractor> {
  return apiRequest<Subcontractor>(`/subcontractors/${id}`);
}

export function createSubcontractor(payload: SubcontractorFormValues): Promise<Subcontractor> {
  return apiRequest<Subcontractor>("/subcontractors", { method: "POST", body: payload });
}

export function updateSubcontractor(
  id: string,
  payload: Partial<SubcontractorFormValues>
): Promise<Subcontractor> {
  return apiRequest<Subcontractor>(`/subcontractors/${id}`, { method: "PATCH", body: payload });
}

export function archiveSubcontractor(id: string): Promise<void> {
  return apiRequest<void>(`/subcontractors/${id}`, { method: "DELETE" });
}

// ---- Work Orders ----

export function listWorkOrders(params: {
  status?: WorkOrderStatus;
  siteId?: string;
}): Promise<PaginatedWorkOrders> {
  return apiRequest<PaginatedWorkOrders>("/work-orders", {
    query: { status: params.status, site_id: params.siteId },
  });
}

export function getWorkOrder(id: string): Promise<WorkOrder> {
  return apiRequest<WorkOrder>(`/work-orders/${id}`);
}

export function createWorkOrder(payload: WorkOrderFormValues): Promise<WorkOrder> {
  return apiRequest<WorkOrder>("/work-orders", { method: "POST", body: payload });
}

export function updateWorkOrder(
  id: string,
  payload: { progress_percent?: number; status?: WorkOrderStatus; wo_value?: number; notes?: string | null }
): Promise<WorkOrder> {
  return apiRequest<WorkOrder>(`/work-orders/${id}`, { method: "PATCH", body: payload });
}

export function addWorkOrderPayment(
  id: string,
  payload: { amount: number; payment_date: string; notes?: string | null }
): Promise<WorkOrder> {
  return apiRequest<WorkOrder>(`/work-orders/${id}/payments`, { method: "POST", body: payload });
}

export function deleteWorkOrder(id: string): Promise<void> {
  return apiRequest<void>(`/work-orders/${id}`, { method: "DELETE" });
}
