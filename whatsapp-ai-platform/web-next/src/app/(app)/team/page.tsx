"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { api } from "@/lib/api";
import type { TeamUser } from "@/lib/types";

const PRESENCE: Record<string, string> = {
  online: "bg-success",
  away: "bg-warning",
  offline: "bg-muted-foreground/40",
};

export default function TeamPage() {
  const [users, setUsers] = useState<TeamUser[]>([]);

  useEffect(() => {
    api.get<{ users: TeamUser[] }>("/users").then((r) => setUsers(r.users)).catch(() => {});
  }, []);

  const byName = (id?: string | null) => users.find((u) => u.id === id)?.displayName || "—";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 border-b bg-card/50">
        <h1 className="text-xl font-semibold">Team</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Agents in this workspace — role, team and presence</p>
      </div>

      <div className="p-8 max-w-4xl">
        <div className="rounded-xl border bg-card shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wide border-b bg-muted/40">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Role</th>
                <th className="px-3 py-3 font-medium">Team</th>
                <th className="px-3 py-3 font-medium">Reports to</th>
                <th className="px-3 py-3 font-medium">Presence</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-semibold">
                        {u.displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium">{u.displayName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className={clsx(
                      "text-[11px] px-2 py-0.5 rounded-full font-medium",
                      u.role === "ADMIN" ? "bg-primary/15 text-primary" : u.role === "RM" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-3">{u.team || "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {u.role === "SALES" ? byName(u.managerId) : u.role === "RM" ? "Admin" : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={clsx("w-2 h-2 rounded-full", PRESENCE[u.presence || "offline"])} />
                      {u.presence || "offline"}
                    </span>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={5} className="px-6 py-6 text-muted-foreground">No team members.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
