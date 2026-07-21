import { apiRequest } from "@/lib/api/client";
import {
  Equipment,
  EquipmentFormValues,
  EquipmentStatus,
  EquipmentUsage,
  MaintenanceLog,
  PaginatedEquipment,
  SiteEquipmentCostItem,
} from "@/lib/types/equipment";

export function listEquipment(params: {
  status?: EquipmentStatus;
  pageSize?: number;
}): Promise<PaginatedEquipment> {
  return apiRequest<PaginatedEquipment>("/equipment", {
    query: { status: params.status, page_size: params.pageSize ?? 100 },
  });
}

export function getEquipment(id: string): Promise<Equipment> {
  return apiRequest<Equipment>(`/equipment/${id}`);
}

export function createEquipment(payload: EquipmentFormValues): Promise<Equipment> {
  return apiRequest<Equipment>("/equipment", { method: "POST", body: payload });
}

export function updateEquipment(
  id: string,
  payload: Partial<EquipmentFormValues>
): Promise<Equipment> {
  return apiRequest<Equipment>(`/equipment/${id}`, { method: "PATCH", body: payload });
}

export function archiveEquipment(id: string): Promise<void> {
  return apiRequest<void>(`/equipment/${id}`, { method: "DELETE" });
}

// ---- Maintenance ----

export function listMaintenance(equipmentId: string): Promise<MaintenanceLog[]> {
  return apiRequest<MaintenanceLog[]>(`/equipment/${equipmentId}/maintenance`);
}

export function addMaintenance(
  equipmentId: string,
  payload: { service_date: string; description: string; cost: number; notes?: string | null }
): Promise<MaintenanceLog> {
  return apiRequest<MaintenanceLog>(`/equipment/${equipmentId}/maintenance`, {
    method: "POST",
    body: payload,
  });
}

// ---- Site usage ----

export function getSiteEquipmentCost(siteId: string): Promise<SiteEquipmentCostItem[]> {
  return apiRequest<SiteEquipmentCostItem[]>(`/sites/${siteId}/equipment/cost-summary`);
}

export function listSiteEquipmentUsage(siteId: string): Promise<EquipmentUsage[]> {
  return apiRequest<EquipmentUsage[]>(`/sites/${siteId}/equipment/usage`);
}

export function addSiteEquipmentUsage(
  siteId: string,
  payload: { equipment_id: string; usage_date: string; quantity: number; cost?: number | null; notes?: string | null }
): Promise<EquipmentUsage> {
  return apiRequest<EquipmentUsage>(`/sites/${siteId}/equipment/usage`, {
    method: "POST",
    body: payload,
  });
}
