export type MaterialStatus = "active" | "inactive";
export type MaterialEntryType = "received" | "used" | "adjustment";

export interface Material {
  id: string;
  org_id: string;
  name: string;
  code: string;
  unit: string;
  category: string | null;
  status: MaterialStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialListItem {
  id: string;
  name: string;
  code: string;
  unit: string;
  category: string | null;
  status: MaterialStatus;
}

export interface PaginatedMaterials {
  items: MaterialListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface MaterialFormValues {
  name: string;
  code: string;
  unit: string;
  category?: string | null;
  status?: MaterialStatus;
  notes?: string | null;
}

export interface MaterialEntry {
  id: string;
  site_id: string;
  material_id: string;
  vendor_id: string | null;
  entry_type: MaterialEntryType;
  quantity: number;
  unit_cost: number | null;
  entry_date: string;
  notes: string | null;
  created_at: string;
}

export interface MaterialEntryFormValues {
  material_id: string;
  vendor_id?: string | null;
  entry_type: MaterialEntryType;
  quantity: number;
  unit_cost?: number | null;
  entry_date: string;
  notes?: string | null;
}

export interface SiteMaterialStockItem {
  material_id: string;
  material_name: string;
  material_code: string;
  unit: string;
  quantity_received: number;
  quantity_used: number;
  quantity_adjusted: number;
  quantity_on_hand: number;
}
