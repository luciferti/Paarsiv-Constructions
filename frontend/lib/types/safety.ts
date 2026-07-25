export type IncidentType =
  | "near_miss"
  | "first_aid"
  | "injury"
  | "property_damage"
  | "environmental"
  | "other";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "investigating" | "closed";

export const INCIDENT_TYPES: IncidentType[] = [
  "near_miss",
  "first_aid",
  "injury",
  "property_damage",
  "environmental",
  "other",
];
export const INCIDENT_SEVERITIES: IncidentSeverity[] = ["low", "medium", "high", "critical"];
export const INCIDENT_STATUSES: IncidentStatus[] = ["open", "investigating", "closed"];

export const INCIDENT_TYPE_LABEL: Record<IncidentType, string> = {
  near_miss: "Near miss",
  first_aid: "First aid",
  injury: "Injury",
  property_damage: "Property damage",
  environmental: "Environmental",
  other: "Other",
};

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  closed: "Closed",
};

export interface Incident {
  id: string;
  org_id: string;
  site_id: string;
  incident_date: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string | null;
  action_taken: string | null;
  reported_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentListItem {
  id: string;
  site_id: string;
  incident_date: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
}

export interface PaginatedIncidents {
  items: IncidentListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface SafetySummary {
  total: number;
  open_count: number;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  days_since_last_incident: number | null;
}

export interface IncidentFormValues {
  site_id: string;
  incident_date: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description?: string | null;
  action_taken?: string | null;
  reported_by?: string | null;
}
