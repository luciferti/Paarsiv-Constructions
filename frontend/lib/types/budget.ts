export interface BudgetLine {
  id: string;
  site_id: string;
  category: string;
  description: string | null;
  budgeted_amount: number;
  notes: string | null;
  created_at: string;
}

export interface BudgetCategoryRow {
  category: string;
  budgeted: number;
}

export interface SiteBudgetSummary {
  site_id: string;
  total_budgeted: number;
  budget_by_category: BudgetCategoryRow[];
  actual_material: number;
  actual_labour: number;
  actual_invoices: number;
  actual_total: number;
  variance: number;
  percent_used: number;
}

export interface BudgetLineFormValues {
  category: string;
  description?: string | null;
  budgeted_amount: number;
  notes?: string | null;
}
