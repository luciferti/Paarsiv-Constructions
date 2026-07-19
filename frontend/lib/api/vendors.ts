import { apiRequest } from "@/lib/api/client";
import { PaginatedVendors, Vendor, VendorFormValues, VendorStatus } from "@/lib/types/vendor";

export function listVendors(params: {
  page?: number;
  pageSize?: number;
  status?: VendorStatus;
  category?: string;
}): Promise<PaginatedVendors> {
  return apiRequest<PaginatedVendors>("/vendors", {
    query: {
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20,
      status: params.status,
      category: params.category,
    },
  });
}

export function getVendor(vendorId: string): Promise<Vendor> {
  return apiRequest<Vendor>(`/vendors/${vendorId}`);
}

export function createVendor(payload: VendorFormValues): Promise<Vendor> {
  return apiRequest<Vendor>("/vendors", { method: "POST", body: payload });
}

export function updateVendor(
  vendorId: string,
  payload: Partial<VendorFormValues>
): Promise<Vendor> {
  return apiRequest<Vendor>(`/vendors/${vendorId}`, { method: "PATCH", body: payload });
}

export function archiveVendor(vendorId: string): Promise<void> {
  return apiRequest<void>(`/vendors/${vendorId}`, { method: "DELETE" });
}
