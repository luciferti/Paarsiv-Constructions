import { apiRequest, apiUpload } from "@/lib/api/client";
import { Invoice, InvoiceReviewValues, InvoiceStatus, PaginatedInvoices } from "@/lib/types/invoice";

export function listInvoices(params: {
  page?: number;
  pageSize?: number;
  vendorId?: string;
  siteId?: string;
  status?: InvoiceStatus;
}): Promise<PaginatedInvoices> {
  return apiRequest<PaginatedInvoices>("/invoices", {
    query: {
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20,
      vendor_id: params.vendorId,
      site_id: params.siteId,
      status: params.status,
    },
  });
}

export function getInvoice(invoiceId: string): Promise<Invoice> {
  return apiRequest<Invoice>(`/invoices/${invoiceId}`);
}

export function uploadInvoice(params: {
  vendorId: string;
  siteId?: string;
  file: File;
}): Promise<Invoice> {
  const formData = new FormData();
  formData.append("vendor_id", params.vendorId);
  if (params.siteId) formData.append("site_id", params.siteId);
  formData.append("file", params.file);
  return apiUpload<Invoice>("/invoices", formData);
}

export function reviewInvoice(
  invoiceId: string,
  payload: InvoiceReviewValues
): Promise<Invoice> {
  return apiRequest<Invoice>(`/invoices/${invoiceId}`, { method: "PATCH", body: payload });
}
