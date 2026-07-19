export type NotificationStatus = "sent" | "logged" | "failed";

export interface Notification {
  id: string;
  site_id: string | null;
  recipient_name: string | null;
  recipient_phone: string;
  message: string;
  status: NotificationStatus;
  provider_used: string;
  created_at: string;
}

export interface PaginatedNotifications {
  items: Notification[];
  total: number;
  page: number;
  page_size: number;
}

export interface NotificationFormValues {
  site_id?: string | null;
  recipient_name?: string | null;
  recipient_phone: string;
  message: string;
}
