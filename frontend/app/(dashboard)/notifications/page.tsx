"use client";

import { useNotifications } from "@/lib/hooks/useNotifications";

const STATUS_LABEL: Record<string, string> = {
  sent: "Sent",
  logged: "Logged (demo)",
  failed: "Failed",
};

const STATUS_CLASS: Record<string, string> = {
  sent: "status-active",
  logged: "status-planning",
  failed: "status-blacklisted",
};

export default function NotificationsPage() {
  const { data, loading, error } = useNotifications({});

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <h1>Notifications</h1>
      </div>
      <p className="field-hint notifications-disclaimer">
        WhatsApp delivery isn&apos;t connected yet (no Twilio credentials configured), so
        messages below were logged here instead of actually sent — see{" "}
        <code>notification/services/whatsapp_provider.py</code>.
      </p>

      {loading && <p>Loading notifications...</p>}
      {error && <p className="form-error">{error}</p>}

      {data && data.items.length === 0 && (
        <p className="empty-state">No notifications sent yet.</p>
      )}

      {data && data.items.length > 0 && (
        <ul className="report-list">
          {data.items.map((n) => (
            <li key={n.id} className="report-item">
              <div className="report-item-header">
                <span className="report-date">
                  {n.recipient_name ?? n.recipient_phone}
                </span>
                <span className="report-weather">{n.recipient_phone}</span>
                <span className={`status-badge ${STATUS_CLASS[n.status]}`}>
                  {STATUS_LABEL[n.status]}
                </span>
              </div>
              <p className="report-summary">{n.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
