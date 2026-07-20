export type WorkerStatus = "active" | "inactive";
export type AttendanceStatus = "present" | "absent" | "half_day";

export interface Worker {
  id: string;
  org_id: string;
  name: string;
  code: string;
  phone: string | null;
  trade: string | null;
  default_wage_rate: number;
  status: WorkerStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkerListItem {
  id: string;
  name: string;
  code: string;
  trade: string | null;
  default_wage_rate: number;
  status: WorkerStatus;
}

export interface PaginatedWorkers {
  items: WorkerListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface WorkerFormValues {
  name: string;
  code: string;
  phone?: string | null;
  trade?: string | null;
  default_wage_rate: number;
  status?: WorkerStatus;
  notes?: string | null;
}

export interface AttendanceEntry {
  id: string;
  site_id: string;
  worker_id: string;
  work_date: string;
  status: AttendanceStatus;
  overtime_hours: number;
  wage_rate: number;
  wage_amount: number;
  notes: string | null;
  created_at: string;
}

export interface AttendanceFormValues {
  worker_id: string;
  work_date: string;
  status: AttendanceStatus;
  overtime_hours?: number;
  wage_rate?: number | null;
  notes?: string | null;
}

export interface SiteLabourSummaryItem {
  worker_id: string;
  worker_name: string;
  worker_code: string;
  trade: string | null;
  days_present: number;
  days_absent: number;
  total_overtime_hours: number;
  total_wages: number;
}
