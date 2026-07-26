import type { Role } from "@prisma/client";

/**
 * Permission catalog. Keys are stable strings stored on User.permissions.
 * Roles provide the defaults; a user with an explicit list overrides them
 * (ADMIN always has everything so nobody can lock the workspace out).
 */
export const PERMISSIONS = [
  // Inbox
  { key: "inbox.view", group: "Inbox", label: "Open the inbox", desc: "See conversations they are allowed to see" },
  { key: "inbox.reply", group: "Inbox", label: "Reply to customers", desc: "Send messages and take over from AI" },
  { key: "inbox.assign", group: "Inbox", label: "Assign conversations", desc: "Move chats between agents" },
  { key: "inbox.notes", group: "Inbox", label: "Write internal notes", desc: "Add notes and labels on a chat" },

  // Contacts
  { key: "contacts.view", group: "Contacts", label: "View contacts", desc: "Browse the contact list and profiles" },
  { key: "contacts.edit", group: "Contacts", label: "Add and edit contacts", desc: "Create contacts, edit fields and tags" },
  { key: "contacts.delete", group: "Contacts", label: "Delete contacts", desc: "Remove contacts permanently" },
  { key: "contacts.import", group: "Contacts", label: "Import and merge", desc: "CSV import and duplicate merging" },
  { key: "contacts.export", group: "Contacts", label: "Export contacts", desc: "Download the contact list as CSV" },
  { key: "segments.manage", group: "Contacts", label: "Manage segments", desc: "Create, edit and delete segments and folders" },
  { key: "fields.manage", group: "Contacts", label: "Manage custom fields", desc: "Add or remove contact fields" },

  // Content
  { key: "templates.view", group: "Content", label: "View templates", desc: "See message templates" },
  { key: "templates.manage", group: "Content", label: "Manage templates", desc: "Create, edit and submit templates to Meta" },
  { key: "media.manage", group: "Content", label: "Manage media", desc: "Upload and organise media files" },

  // Outbound
  { key: "campaigns.view", group: "Outbound", label: "View campaigns", desc: "See campaigns and their results" },
  { key: "campaigns.create", group: "Outbound", label: "Create campaigns", desc: "Build and schedule campaigns" },
  { key: "campaigns.send", group: "Outbound", label: "Send campaigns", desc: "Actually send to customers" },
  { key: "journeys.manage", group: "Outbound", label: "Manage journeys", desc: "Build, activate and run journeys" },

  // Insight
  { key: "reports.view", group: "Insight", label: "View reports", desc: "Dashboards and campaign analytics" },
  { key: "reports.agents", group: "Insight", label: "View agent performance", desc: "See per-agent numbers" },
  { key: "ai.use", group: "Insight", label: "Use AI copilot", desc: "Summaries and suggested replies" },

  // Admin
  { key: "users.manage", group: "Admin", label: "Manage users", desc: "Invite, edit and deactivate users" },
  { key: "ai.manage", group: "Admin", label: "Configure AI", desc: "Switch engines and set API keys" },
  { key: "settings.manage", group: "Admin", label: "Workspace settings", desc: "WhatsApp connection, merge rules, API keys" },
  { key: "logs.view", group: "Admin", label: "View audit and webhook logs", desc: "Security and delivery troubleshooting" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const ALL_PERMISSIONS: string[] = PERMISSIONS.map((p) => p.key);

/** What each role can do out of the box. */
export const ROLE_DEFAULTS: Record<Role, string[]> = {
  ADMIN: ALL_PERMISSIONS,
  RM: [
    "inbox.view", "inbox.reply", "inbox.assign", "inbox.notes",
    "contacts.view", "contacts.edit", "contacts.delete", "contacts.import", "contacts.export",
    "segments.manage", "fields.manage",
    "templates.view", "templates.manage", "media.manage",
    "campaigns.view", "campaigns.create", "campaigns.send", "journeys.manage",
    "reports.view", "reports.agents", "ai.use",
  ],
  SALES: [
    "inbox.view", "inbox.reply", "inbox.notes",
    "contacts.view",
    "templates.view",
    "campaigns.view",
    "reports.view", "ai.use",
  ],
};

export interface PermissionSubject {
  role: Role;
  permissions?: string[] | null;
}

/** Effective list: admins get everything, else explicit list, else role defaults. */
export function effectivePermissions(user: PermissionSubject): string[] {
  if (user.role === "ADMIN") return ALL_PERMISSIONS;
  if (user.permissions && user.permissions.length > 0) return user.permissions;
  return ROLE_DEFAULTS[user.role] ?? [];
}

export function can(user: PermissionSubject, permission: string): boolean {
  return effectivePermissions(user).includes(permission);
}

/** Permissions grouped for the settings UI. */
export function permissionCatalog() {
  const groups: { group: string; items: { key: string; label: string; desc: string }[] }[] = [];
  for (const p of PERMISSIONS) {
    let g = groups.find((x) => x.group === p.group);
    if (!g) { g = { group: p.group, items: [] }; groups.push(g); }
    g.items.push({ key: p.key, label: p.label, desc: p.desc });
  }
  return groups;
}
