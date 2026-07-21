export type MilestoneStatus = "pending" | "in_progress" | "completed" | "delayed";

export const MILESTONE_STATUSES: MilestoneStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "delayed",
];

export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  delayed: "Delayed",
};

export interface Milestone {
  id: string;
  site_id: string;
  title: string;
  target_date: string | null;
  actual_date: string | null;
  progress_percent: number;
  weight: number;
  status: MilestoneStatus;
  notes: string | null;
  created_at: string;
}

export interface SiteProgressSummary {
  site_id: string;
  overall_percent: number;
  milestone_count: number;
  by_status: Record<string, number>;
  milestones: Milestone[];
}

export interface MilestoneFormValues {
  title: string;
  target_date?: string | null;
  progress_percent?: number;
  weight?: number;
  status?: MilestoneStatus;
  notes?: string | null;
}
