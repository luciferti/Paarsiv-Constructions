export type BillStatus = "draft" | "submitted" | "certified" | "paid";

export const BILL_STATUSES: BillStatus[] = ["draft", "submitted", "certified", "paid"];

export const BILL_STATUS_LABEL: Record<BillStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  certified: "Certified",
  paid: "Paid",
};

export interface ClientBill {
  id: string;
  org_id: string;
  site_id: string;
  bill_number: string;
  bill_date: string;
  gross_amount: number;
  retention_percent: number;
  tds_percent: number;
  other_deductions: number;
  status: BillStatus;
  notes: string | null;
  retention_amount: number;
  tds_amount: number;
  net_payable: number;
  created_at: string;
  updated_at: string;
}

export interface ClientBillListRow {
  id: string;
  site_id: string;
  bill_number: string;
  bill_date: string;
  gross_amount: number;
  net_payable: number;
  status: BillStatus;
}

export interface PaginatedClientBills {
  items: ClientBillListRow[];
  total: number;
  page: number;
  page_size: number;
}

export interface ClientBillingSummary {
  total_gross: number;
  total_net: number;
  total_paid: number;
  total_outstanding: number;
  bill_count: number;
}

export interface ClientBillFormValues {
  site_id: string;
  bill_number: string;
  bill_date: string;
  gross_amount: number;
  retention_percent: number;
  tds_percent: number;
  other_deductions: number;
  notes?: string | null;
}
