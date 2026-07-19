export type VendorStatus = "active" | "inactive" | "blacklisted";

export interface Vendor {
  id: string;
  org_id: string;
  name: string;
  code: string;
  category: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  tax_id: string | null;
  status: VendorStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorListItem {
  id: string;
  name: string;
  code: string;
  category: string | null;
  status: VendorStatus;
  phone: string | null;
  email: string | null;
}

export interface PaginatedVendors {
  items: VendorListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface VendorFormValues {
  name: string;
  code: string;
  category?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  tax_id?: string | null;
  status?: VendorStatus;
  notes?: string | null;
}
