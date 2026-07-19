import { apiRequest } from "@/lib/api/client";
import {
  Material,
  MaterialEntry,
  MaterialEntryFormValues,
  MaterialFormValues,
  MaterialStatus,
  PaginatedMaterials,
  SiteMaterialStockItem,
} from "@/lib/types/material";

export function listMaterials(params: {
  page?: number;
  pageSize?: number;
  status?: MaterialStatus;
}): Promise<PaginatedMaterials> {
  return apiRequest<PaginatedMaterials>("/materials", {
    query: { page: params.page ?? 1, page_size: params.pageSize ?? 20, status: params.status },
  });
}

export function getMaterial(materialId: string): Promise<Material> {
  return apiRequest<Material>(`/materials/${materialId}`);
}

export function createMaterial(payload: MaterialFormValues): Promise<Material> {
  return apiRequest<Material>("/materials", { method: "POST", body: payload });
}

export function updateMaterial(
  materialId: string,
  payload: Partial<MaterialFormValues>
): Promise<Material> {
  return apiRequest<Material>(`/materials/${materialId}`, { method: "PATCH", body: payload });
}

export function archiveMaterial(materialId: string): Promise<void> {
  return apiRequest<void>(`/materials/${materialId}`, { method: "DELETE" });
}

export function getSiteMaterialStock(siteId: string): Promise<SiteMaterialStockItem[]> {
  return apiRequest<SiteMaterialStockItem[]>(`/sites/${siteId}/materials/stock`);
}

export function listSiteMaterialEntries(siteId: string): Promise<MaterialEntry[]> {
  return apiRequest<MaterialEntry[]>(`/sites/${siteId}/materials/entries`);
}

export function addSiteMaterialEntry(
  siteId: string,
  payload: MaterialEntryFormValues
): Promise<MaterialEntry> {
  return apiRequest<MaterialEntry>(`/sites/${siteId}/materials/entries`, {
    method: "POST",
    body: payload,
  });
}
