import { useEffect, useState } from "react";
import { api } from "../api";
import type { User } from "../types";

export default function SupervisorPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ users: User[] }>("/users")
      .then((r) => setUsers(r.users))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const byName = (id?: string | null) =>
    users.find((u) => u.id === id)?.displayName || "—";

  return (
    <div className="panel-view">
      <div className="card">
        <h2>Team</h2>
        <p className="card-sub">Agents in this workspace, their role, team and presence.</p>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <table className="roster">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Team</th>
                <th>Reports to</th>
                <th>Presence</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.displayName}</td>
                  <td>{u.role}</td>
                  <td>{u.team || "—"}</td>
                  <td>{u.role === "SALES" ? byName(u.managerId) : u.role === "RM" ? "Admin" : "—"}</td>
                  <td>
                    <span className={`pres-dot pres-${u.presence || "offline"}`} />
                    {u.presence || "offline"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
