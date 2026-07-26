"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, ShieldCheck, UserX } from "lucide-react";
import clsx from "clsx";
import { api, getSession } from "@/lib/api";
import type { UserRow } from "@/components/UserEditor";

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

export default function UsersPage() {
  const router = useRouter();
  const session = typeof window !== "undefined" ? getSession() : null;
  const canManage = session?.user.role === "ADMIN";

  const [users, setUsers] = useState<UserRow[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<{ users: UserRow[] }>("/users").then((r) => setUsers(r.users)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const byName = (id?: string | null) => users.find((u) => u.id === id)?.displayName || "—";

  async function toggleActive(u: UserRow) {
    try {
      await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not change this user.");
      setTimeout(() => setNotice(null), 5000);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 border-b bg-card/50 flex items-center">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">People in this workspace — roles, reporting and permissions</p>
        </div>
        <div className="flex-1" />
        {canManage && (
          <button
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            onClick={() => router.push("/users/new")}
          >
            <Plus className="w-3.5 h-3.5 inline mr-1.5" />Add user
          </button>
        )}
      </div>

      {notice && <div className="px-8 py-2 text-xs text-destructive bg-destructive/10">{notice}</div>}

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
                <tr
                  key={u.id}
                  onClick={() => canManage && router.push(`/users/${u.id}`)}
                  className={clsx(
                    "border-b last:border-0 hover:bg-muted/40",
                    !u.isActive && "opacity-55",
                    canManage && "cursor-pointer"
                  )}
                >
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
                  <td className="px-3 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {canManage && (
                      <>
                        <button className="h-8 px-2.5 rounded-lg border text-xs font-medium hover:bg-muted"
                          onClick={() => router.push(`/users/${u.id}`)}>
                          <Pencil className="w-3 h-3 inline mr-1" />Edit
                        </button>
                        <button className="h-8 px-2.5 rounded-lg border text-xs font-medium hover:bg-muted ml-2"
                          onClick={() => toggleActive(u)}>
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
    </div>
  );
}
