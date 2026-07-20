import { apiRequest } from "@/lib/api/client";
import {
  PaginatedPurchaseOrders,
  POStatus,
  PurchaseOrder,
  PurchaseOrderFormValues,
} from "@/lib/types/purchase";

export function listPurchaseOrders(params: {
  page?: number;
  pageSize?: number;
  status?: POStatus;
}): Promise<PaginatedPurchaseOrders> {
  return apiRequest<PaginatedPurchaseOrders>("/purchase-orders", {
    query: { page: params.page ?? 1, page_size: params.pageSize ?? 20, status: params.status },
  });
}

export function getPurchaseOrder(poId: string): Promise<PurchaseOrder> {
  return apiRequest<PurchaseOrder>(`/purchase-orders/${poId}`);
}

export function createPurchaseOrder(payload: PurchaseOrderFormValues): Promise<PurchaseOrder> {
  return apiRequest<PurchaseOrder>("/purchase-orders", { method: "POST", body: payload });
}

export function updatePurchaseOrder(
  poId: string,
  payload: { status?: POStatus; expected_date?: string | null; notes?: string | null }
): Promise<PurchaseOrder> {
  return apiRequest<PurchaseOrder>(`/purchase-orders/${poId}`, { method: "PATCH", body: payload });
}

export function cancelPurchaseOrder(poId: string): Promise<void> {
  return apiRequest<void>(`/purchase-orders/${poId}`, { method: "DELETE" });
}
