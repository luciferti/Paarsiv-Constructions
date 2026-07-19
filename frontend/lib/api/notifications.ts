import { apiRequest } from "@/lib/api/client";
import { Notification, NotificationFormValues, PaginatedNotifications } from "@/lib/types/notification";

export function listNotifications(params: {
  page?: number;
  pageSize?: number;
  siteId?: string;
}): Promise<PaginatedNotifications> {
  return apiRequest<PaginatedNotifications>("/notifications", {
    query: { page: params.page ?? 1, page_size: params.pageSize ?? 20, site_id: params.siteId },
  });
}

export function sendNotification(payload: NotificationFormValues): Promise<Notification> {
  return apiRequest<Notification>("/notifications", { method: "POST", body: payload });
}
