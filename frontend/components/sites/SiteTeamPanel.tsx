"use client";

import { FormEvent, useState } from "react";

import { addTeamMember, removeTeamMember } from "@/lib/api/sites";
import { useSiteTeam } from "@/lib/hooks/useSites";

export function SiteTeamPanel({ siteId }: { siteId: string }) {
  const { data: members, loading, error, refetch } = useSiteTeam(siteId);
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!employeeId || !role) return;
    setSubmitting(true);
    try {
      await addTeamMember(siteId, { employee_id: employeeId, role_on_site: role });
      setEmployeeId("");
      setRole("");
      refetch();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(employeeIdToRemove: string) {
    await removeTeamMember(siteId, employeeIdToRemove);
    refetch();
  }

  if (loading) return <p>Loading team...</p>;
  if (error) return <p className="form-error">{error}</p>;

  return (
    <div className="site-team-panel">
      <ul>
        {members?.map((member) => (
          <li key={member.id}>
            <span>{member.employee_id}</span>
            <span>{member.role_on_site}</span>
            <button type="button" onClick={() => handleRemove(member.employee_id)}>
              Remove
            </button>
          </li>
        ))}
        {members?.length === 0 && <li>No team members assigned yet.</li>}
      </ul>

      <form onSubmit={handleAdd} className="add-team-member-form">
        <input
          placeholder="Employee ID"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        />
        <input
          placeholder="Role on site (e.g. Foreman)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        <button type="submit" disabled={submitting}>
          Add
        </button>
      </form>
    </div>
  );
}
