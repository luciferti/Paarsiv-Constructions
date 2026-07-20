export type POStatus =
  | "draft"
  | "sent"
  | "partially_received"
  | "received"
  | "closed"
  | "cancelled";

export const PO_STATUSES: POStatus[] = [
  "draft",
  "sent",
  "partially_received",
  "received",
  "closed",
  "cancelled",
];

export const PO_STATUS_LABEL: Record<POStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_received: "Partially received",
  received: "Received",
  closed: "Closed",
  cancelled: "Cancelled",
};

export interface POLine {
  id: string;
  material_id: string | null;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  line_total: number;
}

export interface PurchaseOrder {
  id: string;
  org_id: string;
  po_number: string;
  vendor_id: string;
  site_id: string | null;
  status: POStatus;
  order_date: string;
  expected_date: string | null;
  notes: string | null;
  lines: POLine[];
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderListItem {
  id: string;
  po_number: string;
  vendor_id: string;
  site_id: string | null;
  status: POStatus;
  order_date: string;
  total_amount: number;
}

export interface PaginatedPurchaseOrders {
  items: PurchaseOrderListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface POLineFormValues {
  material_id?: string | null;
  description: string;
  quantity: number;
  unit?: string | null;
  unit_price: number;
}

export interface PurchaseOrderFormValues {
  po_number: string;
  vendor_id: string;
  site_id?: string | null;
  order_date: string;
  expected_date?: string | null;
  notes?: string | null;
  lines: POLineFormValues[];
}
