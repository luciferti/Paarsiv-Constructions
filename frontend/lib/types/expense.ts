export type CashEntryType = "topup" | "expense";

export interface CashEntry {
  id: string;
  org_id: string;
  site_id: string | null;
  entry_type: CashEntryType;
  category: string | null;
  amount: number;
  entry_date: string;
  paid_to: string | null;
  notes: string | null;
  created_at: string;
}

export interface ExpenseCategoryRow {
  category: string;
  amount: number;
}

export interface PettyCashSummary {
  total_topup: number;
  total_expense: number;
  balance: number;
  expense_by_category: ExpenseCategoryRow[];
}

export interface CashEntryFormValues {
  site_id?: string | null;
  entry_type: CashEntryType;
  category?: string | null;
  amount: number;
  entry_date: string;
  paid_to?: string | null;
  notes?: string | null;
}
