export type SubcontractorStatus = "active" | "inactive";
export type WorkOrderStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "closed"
  | "cancelled";

export const WO_STATUSES: WorkOrderStatus[] = [
  "open",
  "in_progress",
  "completed",
  "closed",
  "cancelled",
];

export const WO_STATUS_LABEL: Record<WorkOrderStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  completed: "Completed",
  closed: "Closed",
  cancelled: "Cancelled",
};

export interface Subcontractor {
  id: string;
  org_id: string;
  name: string;
  code: string;
  trade: string | null;
  contact_name: string | null;
  phone: string | null;
  status: SubcontractorStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubcontractorListItem {
  id: string;
  name: string;
  code: string;
  trade: string | null;
  status: SubcontractorStatus;
}

export interface PaginatedSubcontractors {
  items: SubcontractorListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface SubcontractorFormValues {
  name: string;
  code: string;
  trade?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  status?: SubcontractorStatus;
  notes?: string | null;
}

export interface WorkOrderPayment {
  id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
}

export interface WorkOrder {
  id: string;
  org_id: string;
  wo_number: string;
  site_id: string;
  subcontractor_id: string;
  title: string;
  order_date: string;
  wo_value: number;
  progress_percent: number;
  status: WorkOrderStatus;
  notes: string | null;
  payments: WorkOrderPayment[];
  total_paid: number;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderListRow {
  id: string;
  wo_number: string;
  site_id: string;
  subcontractor_id: string;
  title: string;
  wo_value: number;
  total_paid: number;
  balance: number;
  progress_percent: number;
  status: WorkOrderStatus;
}

export interface PaginatedWorkOrders {
  items: WorkOrderListRow[];
  total: number;
  page: number;
  page_size: number;
}

export interface WorkOrderFormValues {
  wo_number: string;
  site_id: string;
  subcontractor_id: string;
  title: string;
  order_date: string;
  wo_value: number;
  notes?: string | null;
}
