export interface DailyReport {
  id: string;
  site_id: string;
  org_id: string;
  report_date: string;
  manpower_count: number | null;
  weather: string | null;
  work_summary: string;
  issues: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyReportFormValues {
  report_date: string;
  manpower_count?: number | null;
  weather?: string | null;
  work_summary: string;
  issues?: string | null;
}
