/**
 * Client-side mirror of backend app/core/permissions.py — used only to
 * hide UI a role can't use (the backend is the real enforcement). Keep the
 * role rules in sync with the server.
 */
const FINANCIAL = new Set(["bill", "budget", "expense", "invoice", "po"]);
const OPERATIONAL = new Set([
  "site", "material", "worker", "labour", "equipment", "report", "safety",
  "progress", "subcontractor", "workorder", "document", "summary", "notification", "vendor",
]);
const ADMIN_ONLY = new Set(["users:manage", "demo:seed", "messaging:admin"]);

export function hasPermission(role: string | undefined | null, perm: string): boolean {
  const r = role ?? "viewer";
  if (r === "admin") return true;
  if (ADMIN_ONLY.has(perm)) return false;
  if (r === "manager") return true;

  const parts = perm.split(":");
  const resource = parts[0];
  const action = parts[parts.length - 1];
  if (action === "view" || perm === "assistant:use") return true;
  if (r === "accountant") return FINANCIAL.has(resource);
  if (r === "site_engineer") return OPERATIONAL.has(resource);
  return false; // viewer
}
