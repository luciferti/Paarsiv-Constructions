export type DocumentCategory =
  | "contract"
  | "permit"
  | "drawing"
  | "license"
  | "ra_bill"
  | "safety"
  | "compliance"
  | "other";

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  "contract",
  "permit",
  "drawing",
  "license",
  "ra_bill",
  "safety",
  "compliance",
  "other",
];

export const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  contract: "Contract",
  permit: "Permit",
  drawing: "Drawing",
  license: "License",
  ra_bill: "RA Bill",
  safety: "Safety",
  compliance: "Compliance",
  other: "Other",
};

export interface Document {
  id: string;
  org_id: string;
  site_id: string | null;
  title: string;
  category: DocumentCategory;
  url: string;
  reference_no: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentListItem {
  id: string;
  site_id: string | null;
  title: string;
  category: DocumentCategory;
  url: string;
  reference_no: string | null;
  expiry_date: string | null;
}

export interface PaginatedDocuments {
  items: DocumentListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface DocumentSummary {
  total: number;
  by_category: Record<string, number>;
  expiring_soon: number;
  expired: number;
}

export interface DocumentFormValues {
  site_id?: string | null;
  title: string;
  category: DocumentCategory;
  url: string;
  reference_no?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
}
