export type InvoiceStatus = "pending_review" | "approved" | "rejected";

export interface Invoice {
  id: string;
  org_id: string;
  vendor_id: string;
  site_id: string | null;
  file_path: string;
  original_filename: string;
  invoice_number: string | null;
  invoice_date: string | null;
  amount: number | null;
  status: InvoiceStatus;
  raw_ocr_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedInvoices {
  items: Invoice[];
  total: number;
  page: number;
  page_size: number;
}

export interface InvoiceReviewValues {
  invoice_number?: string | null;
  invoice_date?: string | null;
  amount?: number | null;
  status?: InvoiceStatus;
}
