import { apiRequest } from "@/lib/api/client";
import {
  BillStatus,
  ClientBill,
  ClientBillFormValues,
  ClientBillingSummary,
  PaginatedClientBills,
} from "@/lib/types/billing";

export function listClientBills(params: {
  page?: number;
  pageSize?: number;
  status?: BillStatus;
  siteId?: string;
}): Promise<PaginatedClientBills> {
  return apiRequest<PaginatedClientBills>("/client-bills", {
    query: {
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20,
      status: params.status,
      site_id: params.siteId,
    },
  });
}

export function getClientBillingSummary(siteId?: string): Promise<ClientBillingSummary> {
  return apiRequest<ClientBillingSummary>("/client-bills/summary", { query: { site_id: siteId } });
}

export function getClientBill(billId: string): Promise<ClientBill> {
  return apiRequest<ClientBill>(`/client-bills/${billId}`);
}

export function createClientBill(payload: ClientBillFormValues): Promise<ClientBill> {
  return apiRequest<ClientBill>("/client-bills", { method: "POST", body: payload });
}

export function updateClientBill(
  billId: string,
  payload: { status?: BillStatus; notes?: string | null }
): Promise<ClientBill> {
  return apiRequest<ClientBill>(`/client-bills/${billId}`, { method: "PATCH", body: payload });
}

export function deleteClientBill(billId: string): Promise<void> {
  return apiRequest<void>(`/client-bills/${billId}`, { method: "DELETE" });
}
