import { Notification } from "@/lib/types/notification";

export interface RecentReportItem {
  site_id: string;
  site_name: string;
  report_date: string;
  work_summary: string;
}

export interface DashboardSummary {
  total_sites: number;
  sites_by_status: Record<string, number>;
  total_vendors: number;
  total_materials: number;
  pending_invoices: number;
  recent_reports: RecentReportItem[];
  recent_notifications: Notification[];
}
