"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  createTeamMember,
  listTeam,
  ROLE_LABEL,
  ROLES,
  Role,
  TeamMember,
  updateTeamMember,
} from "@/lib/api/auth";
import { getUser } from "@/lib/auth/session";

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meEmail, setMeEmail] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    listTeam()
      .then((data) => {
        setMembers(data);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setMeEmail(getUser()?.email ?? null);
    load();
  }, [load]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!name.trim() || !email.trim() || password.length < 8) {
      setFormError("Name, email and a password of 8+ characters are required");
      return;
    }
    setSubmitting(true);
    try {
      await createTeamMember({ name: name.trim(), email: email.trim(), password, role });
      setName("");
      setEmail("");
      setPassword("");
      setRole("viewer");
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRole(id: string, newRole: Role) {
    await updateTeamMember(id, { role: newRole });
    load();
  }

  async function handleActive(id: string, isActive: boolean) {
    await updateTeamMember(id, { is_active: isActive });
    load();
  }

  if (error) {
    return (
      <div className="sites-page">
        <h1>Team</h1>
        <p className="form-error">{error}</p>
        <p className="field-hint">Only admins can manage team members.</p>
      </div>
    );
  }

  return (
    <div className="sites-page">
      <div className="sites-page-header">
        <h1>Team</h1>
      </div>

      {members && (
        <table className="site-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isSelf = m.email === meEmail;
              return (
                <tr key={m.id}>
                  <td className="cell-name">{m.name}{isSelf && <span className="site-code"> (you)</span>}</td>
                  <td>{m.email}</td>
                  <td>
                    <select
                      value={m.role}
                      disabled={isSelf}
                      onChange={(e) => handleRole(m.id, e.target.value as Role)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {isSelf ? (
                      <span className="status-badge status-active">Active</span>
                    ) : (
                      <button
                        type="button"
                        className={m.is_active ? "link-danger" : "button-secondary"}
                        onClick={() => handleActive(m.id, !m.is_active)}
                      >
                        {m.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <form onSubmit={handleCreate} className="material-entry-form">
        <h3 className="form-section-title">Add team member</h3>
        {formError && <p className="form-error">{formError}</p>}
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="tm-name">Name</label>
            <input id="tm-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="tm-email">Email</label>
            <input id="tm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="form-grid form-grid-2">
          <div className="form-field">
            <label htmlFor="tm-password">Temporary Password</label>
            <input id="tm-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8+ characters" />
          </div>
          <div className="form-field">
            <label htmlFor="tm-role">Role</label>
            <select id="tm-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? "Adding…" : "Add Member"}
        </button>
      </form>
    </div>
  );
}
