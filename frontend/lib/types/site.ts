export type SiteStatus = "planning" | "active" | "on_hold" | "completed" | "archived";

export interface Site {
  id: string;
  org_id: string;
  project_id: string | null;
  name: string;
  code: string;
  address_line: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  site_type: string | null;
  status: SiteStatus;
  start_date: string | null;
  expected_end_date: string | null;
  actual_end_date: string | null;
  site_manager_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteListItem {
  id: string;
  name: string;
  code: string;
  status: SiteStatus;
  project_id: string | null;
  city: string | null;
  state: string | null;
}

export interface PaginatedSites {
  items: SiteListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface SiteTeamMember {
  id: string;
  site_id: string;
  employee_id: string;
  role_on_site: string;
  assigned_at: string;
}

export interface SiteFormValues {
  project_id?: string | null;
  name: string;
  code: string;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  site_type?: string | null;
  status?: SiteStatus;
  start_date?: string | null;
  expected_end_date?: string | null;
  actual_end_date?: string | null;
  site_manager_id?: string | null;
}
