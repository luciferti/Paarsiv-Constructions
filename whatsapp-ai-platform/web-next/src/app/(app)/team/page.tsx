"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, ShieldCheck, UserX, X } from "lucide-react";
import clsx from "clsx";
import { api, getSession } from "@/lib/api";

interface UserRow {
  id: string;
  username: string;
  displayName: string;
  role: "ADMIN" | "RM" | "SALES";
  team?: string | null;
  presence?: string;
  managerId?: string | null;
  permissions: string[];
  effectivePermissions: string[];
  usesRoleDefaults: boolean;
  isActive: boolean;
}
interface PermGroup {
  group: string;
  items: { key: string; label: string; desc: string }[];
}

const PRESENCE: Record<string, string> = {
  online: "bg-success",
  away: "bg-warning",
  offline: "bg-muted-foreground/40",
};
const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-primary/15 text-primary",
  RM: "bg-accent text-accent-foreground",
  SALES: "bg-muted text-muted-foreground",
};
const ROLE_HINT: Record<string, string> = {
  ADMIN: "Full access to everything, including settings and users",
  RM: "Manages their team's chats, contacts, campaigns and journeys",
  SALES: "Handles their own conversations",
};

const input = "w-full h-9 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const label = "text-xs font-medium text-muted-foreground";
const btnPri = "h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted";

interface Draft {
  id?: string;
  username: string;
  password: string;
  displayName: string;
  role: "ADMIN" | "RM" | "SALES";
  team: string;
  managerId: string;
  isActive: boolean;
  permissions: string[];
  usesRoleDefaults: boolean;
}

export default function UsersPage() {
  const session = typeof window !== "undefined" ? getSession() : null;
  const canManage = session?.user.role === "ADMIN";

  const [users, setUsers] = useState<UserRow[]>([]);
  const [groups, setGroups] = useState<PermGroup[]>([]);
  const [roleDefaults, setRoleDefaults] = useState<Record<string, string[]>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<{ users: UserRow[] }>("/users").then((r) => setUsers(r.users)).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    api.get<{ groups: PermGroup[]; roleDefaults: Record<string, string[]> }>("/users/permissions")
      .then((r) => { setGroups(r.groups); setRoleDefaults(r.roleDefaults); })
      .catch(() => {});
  }, [load]);

  const byName = (id?: string | null) => users.find((u) => u.id === id)?.displayName || "—";

  function openNew() {
    setErr(null);
    setDraft({
      username: "", password: "", displayName: "", role: "SALES",
      team: "", managerId: "", isActive: true, permissions: [], usesRoleDefaults: true,
    });
  }
  function openEdit(u: UserRow) {
    setErr(null);
    setDraft({
      id: u.id, username: u.username, password: "", displayName: u.displayName,
      role: u.role, team: u.team || "", managerId: u.managerId || "",
      isActive: u.isActive,
      permissions: u.usesRoleDefaults ? [...u.effectivePermissions] : [...u.permissions],
      usesRoleDefaults: u.usesRoleDefaults,
    });
  }
  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  function togglePerm(key: string) {
    if (!draft) return;
    const has = draft.permissions.includes(key);
    patch({
      permissions: has ? draft.permissions.filter((k) => k !== key) : [...draft.permissions, key],
      usesRoleDefaults: false,
    });
  }
  function resetToRole() {
    if (!draft) return;
    patch({ permissions: [...(roleDefaults[draft.role] || [])], usesRoleDefaults: true });
  }

  async function save() {
    if (!draft) return;
    setErr(null);
    try {
      if (draft.id) {
        await api.patch(`/users/${draft.id}`, {
          displayName: draft.displayName,
          role: draft.role,
          team: draft.team || null,
          managerId: draft.managerId || null,
          isActive: draft.isActive,
          // Empty array = fall back to role defaults.
          permissions: draft.usesRoleDefaults ? [] : draft.permissions,
        });
        if (draft.password) {
          await api.post(`/users/${draft.id}/password`, { password: draft.password });
        }
        setNotice(`Saved ${draft.displayName}.`);
      } else {
        await api.post("/users", {
          username: draft.username.trim(),
          password: draft.password,
          displayName: draft.displayName.trim(),
          role: draft.role,
          team: draft.team || undefined,
          managerId: draft.managerId || null,
          permissions: draft.usesRoleDefaults ? [] : draft.permissions,
        });
        setNotice(`Added ${draft.displayName}.`);
      }
      setDraft(null);
      load();
      setTimeout(() => setNotice(null), 4000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save the user.");
    }
  }

  async function toggleActive(u: UserRow) {
    try {
      await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not change this user.");
      setTimeout(() => setNotice(null), 5000);
    }
  }

  const managers = users.filter((u) => u.role !== "SALES" && u.id !== draft?.id);
  const effectiveCount = draft
    ? (draft.usesRoleDefaults ? (roleDefaults[draft.role] || []).length : draft.permissions.length)
    : 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 border-b bg-card/50 flex items-center">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">People in this workspace — roles, reporting and permissions</p>
        </div>
        <div className="flex-1" />
        {canManage && <button className={btnPri} onClick={openNew}><Plus className="w-3.5 h-3.5 inline mr-1.5" />Add user</button>}
      </div>

      {notice && <div className="px-8 py-2 text-xs text-primary bg-accent/60">{notice}</div>}

      <div className="p-8 max-w-5xl">
        <div className="rounded-xl border bg-card shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wide border-b bg-muted/40">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Role</th>
                <th className="px-3 py-3 font-medium">Team</th>
                <th className="px-3 py-3 font-medium">Reports to</th>
                <th className="px-3 py-3 font-medium">Access</th>
                <th className="px-3 py-3 font-medium">Presence</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={clsx("border-b last:border-0 hover:bg-muted/40", !u.isActive && "opacity-55")}>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-semibold">
                        {u.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{u.displayName}</div>
                        <div className="text-[11px] text-muted-foreground">@{u.username}{!u.isActive && " · deactivated"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={clsx("text-[11px] px-2 py-0.5 rounded-full font-medium", ROLE_BADGE[u.role])}>{u.role}</span>
                  </td>
                  <td className="px-3 py-3">{u.team || "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {u.role === "SALES" ? byName(u.managerId) : u.role === "RM" ? "Admin" : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {u.usesRoleDefaults ? "Role defaults" : `Custom · ${u.permissions.length}`}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={clsx("w-2 h-2 rounded-full", PRESENCE[u.presence || "offline"])} />
                      {u.presence || "offline"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {canManage && (
                      <>
                        <button className="h-8 px-2.5 rounded-lg border text-xs font-medium hover:bg-muted" onClick={() => openEdit(u)}>
                          <Pencil className="w-3 h-3 inline mr-1" />Edit
                        </button>
                        <button className="h-8 px-2.5 rounded-lg border text-xs font-medium hover:bg-muted ml-2" onClick={() => toggleActive(u)}>
                          <UserX className="w-3 h-3 inline mr-1" />{u.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={7} className="px-6 py-6 text-muted-foreground">No users yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* editor drawer */}
      {draft && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => setDraft(null)}>
          <div className="w-[460px] max-w-[94vw] h-full bg-card border-l flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <span className="font-semibold">{draft.id ? `Edit ${draft.displayName}` : "Add user"}</span>
              <button onClick={() => setDraft(null)} className="p-1.5 rounded-md hover:bg-muted"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
              <div>
                <label className={label}>Full name</label>
                <input className={clsx(input, "mt-1")} value={draft.displayName} onChange={(e) => patch({ displayName: e.target.value })} placeholder="Priya Sharma" />
              </div>

              {!draft.id && (
                <div>
                  <label className={label}>Username</label>
                  <input className={clsx(input, "mt-1")} value={draft.username} onChange={(e) => patch({ username: e.target.value })} placeholder="priya" />
                </div>
              )}

              <div>
                <label className={label}>{draft.id ? "New password (leave blank to keep)" : "Password"}</label>
                <div className="relative mt-1">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" className={clsx(input, "pl-9")} value={draft.password}
                    onChange={(e) => patch({ password: e.target.value })} placeholder="At least 6 characters" />
                </div>
              </div>

              <div>
                <label className={label}>Role</label>
                <div className="mt-1.5 space-y-1.5">
                  {(["ADMIN", "RM", "SALES"] as const).map((r) => (
                    <button key={r}
                      onClick={() => patch({ role: r, permissions: draft.usesRoleDefaults ? [...(roleDefaults[r] || [])] : draft.permissions })}
                      className={clsx("w-full text-left rounded-lg border-2 px-3 py-2 transition-colors",
                        draft.role === r ? "border-primary bg-accent" : "hover:bg-muted/60")}>
                      <div className="text-[13px] font-medium">{r}</div>
                      <div className="text-[10px] text-muted-foreground">{ROLE_HINT[r]}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Team</label>
                  <input className={clsx(input, "mt-1")} value={draft.team} onChange={(e) => patch({ team: e.target.value })} placeholder="North" />
                </div>
                <div>
                  <label className={label}>Reports to</label>
                  <select className={clsx(input, "mt-1")} value={draft.managerId} onChange={(e) => patch({ managerId: e.target.value })}>
                    <option value="">Nobody</option>
                    {managers.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                  </select>
                </div>
              </div>

              {draft.id && (
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <div className="text-[13px] font-medium">Active</div>
                    <div className="text-[10px] text-muted-foreground">Deactivated users cannot sign in</div>
                  </div>
                  <button onClick={() => patch({ isActive: !draft.isActive })}
                    className={clsx("w-10 h-6 rounded-full relative transition-colors", draft.isActive ? "bg-primary" : "bg-muted")}>
                    <span className={clsx("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all", draft.isActive ? "left-[18px]" : "left-0.5")} />
                  </button>
                </div>
              )}

              {/* permissions */}
              <div className="pt-1">
                <div className="flex items-center gap-2">
                  <label className={label}>Permissions</label>
                  <span className="text-[10px] text-muted-foreground">{effectiveCount} enabled</span>
                  <div className="flex-1" />
                  <button className="text-[11px] text-primary hover:underline" onClick={resetToRole}>
                    Reset to {draft.role} defaults
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 mb-2">
                  {draft.role === "ADMIN"
                    ? "Admins always have every permission."
                    : draft.usesRoleDefaults
                      ? "Following the role defaults. Toggle anything to customise this user."
                      : "Custom set — this user no longer follows the role defaults."}
                </p>

                <div className={clsx("space-y-3", draft.role === "ADMIN" && "opacity-50 pointer-events-none")}>
                  {groups.map((g) => (
                    <div key={g.group} className="rounded-lg border overflow-hidden">
                      <div className="px-3 py-1.5 bg-muted/50 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.group}
                      </div>
                      <div className="divide-y">
                        {g.items.map((it) => {
                          const on = draft.role === "ADMIN" || draft.permissions.includes(it.key);
                          return (
                            <button key={it.key} onClick={() => togglePerm(it.key)}
                              className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-muted/40">
                              <span className={clsx("mt-0.5 w-8 h-[18px] rounded-full relative shrink-0 transition-colors",
                                on ? "bg-primary" : "bg-muted")}>
                                <span className={clsx("absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all",
                                  on ? "left-[16px]" : "left-0.5")} />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-[13px] font-medium">{it.label}</span>
                                <span className="block text-[10px] text-muted-foreground">{it.desc}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {err && <p className="text-xs text-destructive">{err}</p>}
            </div>

            <div className="px-5 py-3.5 border-t flex items-center gap-2">
              <div className="flex-1" />
              <button className={btnGhost} onClick={() => setDraft(null)}>Cancel</button>
              <button className={btnPri} onClick={save}
                disabled={!draft.displayName.trim() || (!draft.id && (!draft.username.trim() || draft.password.length < 6))}>
                {draft.id ? "Save changes" : "Create user"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
