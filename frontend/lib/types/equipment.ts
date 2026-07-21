export type EquipmentOwnership = "owned" | "rented";
export type EquipmentStatus = "available" | "in_use" | "maintenance" | "retired";

export const EQUIPMENT_STATUSES: EquipmentStatus[] = [
  "available",
  "in_use",
  "maintenance",
  "retired",
];

export const EQUIPMENT_STATUS_LABEL: Record<EquipmentStatus, string> = {
  available: "Available",
  in_use: "In use",
  maintenance: "Maintenance",
  retired: "Retired",
};

export interface Equipment {
  id: string;
  org_id: string;
  name: string;
  code: string;
  category: string | null;
  ownership: EquipmentOwnership;
  status: EquipmentStatus;
  rental_rate: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentListItem {
  id: string;
  name: string;
  code: string;
  category: string | null;
  ownership: EquipmentOwnership;
  status: EquipmentStatus;
  rental_rate: number;
}

export interface PaginatedEquipment {
  items: EquipmentListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface EquipmentFormValues {
  name: string;
  code: string;
  category?: string | null;
  ownership?: EquipmentOwnership;
  status?: EquipmentStatus;
  rental_rate: number;
  notes?: string | null;
}

export interface EquipmentUsage {
  id: string;
  equipment_id: string;
  site_id: string;
  usage_date: string;
  quantity: number;
  cost: number;
  notes: string | null;
  created_at: string;
}

export interface SiteEquipmentCostItem {
  equipment_id: string;
  equipment_name: string;
  equipment_code: string;
  total_quantity: number;
  total_cost: number;
}

export interface MaintenanceLog {
  id: string;
  equipment_id: string;
  service_date: string;
  description: string;
  cost: number;
  notes: string | null;
  created_at: string;
}
