// The backend always generates timestamps in UTC, but SQLite (used in
// local/demo mode) drops the timezone suffix on round-trip, so the API
// can return either "...789541" (naive, actually UTC) or "...789541+00:00"
// depending on the database. Treat a suffix-less timestamp as UTC rather
// than letting `new Date()` assume the browser's local timezone.
export function parseApiDate(isoDate: string): Date {
  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(isoDate);
  return new Date(hasTimezone ? isoDate : `${isoDate}Z`);
}

export function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - parseApiDate(isoDate).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
