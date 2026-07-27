"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";

export interface UserRow {
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
  phoneNumberIds?: string[];
  isActive: boolean;
}
interface PermGroup {
  group: string;
  items: { key: string; label: string; desc: string }[];
}

const ROLE_HINT: Record<string, string> = {
  ADMIN: "Full access to everything, including settings and users",
  RM: "Manages their team's chats, contacts, campaigns and journeys",
  SALES: "Handles their own conversations",
};

const input = "w-full h-10 px-3 rounded-lg border bg-background text-sm outline-none focus:ring-2 focus:ring-ring";
const label = "text-xs font-medium text-muted-foreground";
const btnPri = "h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50";
const btnGhost = "h-9 px-4 rounded-lg border text-sm font-medium hover:bg-muted";

export default function UserEditor({ userId }: { userId?: string }) {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [groups, setGroups] = useState<PermGroup[]>([]);
  const [roleDefaults, setRoleDefaults] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(!!userId);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    username: "", password: "", displayName: "",
    role: "SALES" as "ADMIN" | "RM" | "SALES",
    team: "", managerId: "", isActive: true,
    permissions: [] as string[], usesRoleDefaults: true,
    phoneNumberIds: [] as string[],
  });

  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  const [numbers, setNumbers] = useState<{ phoneNumberId: string; displayPhoneNumber: string; label?: string | null }[]>([]);

  const loadCatalog = useCallback(() => {
    api.get<{ numbers: typeof numbers }>("/users/numbers")
      .then((r) => setNumbers(r.numbers)).catch(() => {});
    api.get<{ groups: PermGroup[]; roleDefaults: Record<string, string[]> }>("/users/permissions")
      .then((r) => {
        setGroups(r.groups);
        setRoleDefaults(r.roleDefaults);
        if (!userId) patch({ permissions: [...(r.roleDefaults.SALES || [])] });
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    loadCatalog();
    api.get<{ users: UserRow[] }>("/users")
      .then((r) => {
        setUsers(r.users);
        if (!userId) return;
        const u = r.users.find((x) => x.id === userId);
        if (u) {
          setForm({
            username: u.username, password: "", displayName: u.displayName,
            role: u.role, team: u.team || "", managerId: u.managerId || "",
            isActive: u.isActive,
            permissions: u.usesRoleDefaults ? [...u.effectivePermissions] : [...u.permissions],
            usesRoleDefaults: u.usesRoleDefaults,
            phoneNumberIds: [...(u.phoneNumberIds || [])],
          });
        }
      })
      .finally(() => setLoading(false));
  }, [userId, loadCatalog]);

  function togglePerm(key: string) {
    const has = form.permissions.includes(key);
    patch({
      permissions: has ? form.permissions.filter((k) => k !== key) : [...form.permissions, key],
      usesRoleDefaults: false,
    });
  }
  function toggleNumber(id: string) {
    const has = form.phoneNumberIds.includes(id);
    patch({
      phoneNumberIds: has
        ? form.phoneNumberIds.filter((n) => n !== id)
        : [...form.phoneNumberIds, id],
    });
  }

  function resetToRole() {
    patch({ permissions: [...(roleDefaults[form.role] || [])], usesRoleDefaults: true });
  }

  async function save() {
    setErr(null);
    if (!form.displayName.trim()) { setErr("Enter the person's name."); return; }
    if (!userId && (!form.username.trim() || form.password.length < 6)) {
      setErr("Username and a password of at least 6 characters are required.");
      return;
    }
    setSaving(true);
    try {
      if (userId) {
        await api.patch(`/users/${userId}`, {
          displayName: form.displayName.trim(),
          role: form.role,
          team: form.team || null,
          managerId: form.managerId || null,
          isActive: form.isActive,
          permissions: form.usesRoleDefaults ? [] : form.permissions,
          phoneNumberIds: form.phoneNumberIds,
        });
        if (form.password) await api.post(`/users/${userId}/password`, { password: form.password });
      } else {
        await api.post("/users", {
          username: form.username.trim(),
          password: form.password,
          displayName: form.displayName.trim(),
          role: form.role,
          team: form.team || undefined,
          managerId: form.managerId || null,
          permissions: form.usesRoleDefaults ? [] : form.permissions,
          phoneNumberIds: form.phoneNumberIds,
        });
      }
      router.push("/users");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save this user.");
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex-1 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  const managers = users.filter((u) => u.role !== "SALES" && u.id !== userId);
  const enabled = form.role === "ADMIN"
    ? groups.reduce((a, g) => a + g.items.length, 0)
    : form.usesRoleDefaults ? (roleDefaults[form.role] || []).length : form.permissions.length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-16 shrink-0 border-b bg-card/60 flex items-center gap-3 px-6">
        <button onClick={() => router.push("/users")} className="p-2 -ml-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-base font-semibold">{userId ? `Edit ${form.displayName || "user"}` : "Add user"}</h1>
          <p className="text-xs text-muted-foreground">
            {userId ? "Change their role, reporting line and what they can do" : "Create a login and choose what they can do"}
          </p>
        </div>
        <div className="flex-1" />
        {err && <span className="text-xs text-destructive mr-2">{err}</span>}
        <button className={btnGhost} onClick={() => router.push("/users")}>Cancel</button>
        <button className={btnPri} onClick={save} disabled={saving}>
          {saving && <Loader2 className="w-3.5 h-3.5 inline mr-1.5 animate-spin" />}
          {userId ? "Save changes" : "Create user"}
        </button>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* details */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-8 space-y-7">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Profile</h2>
              <div>
                <label className={label}>Full name</label>
                <input className={clsx(input, "mt-1.5")} value={form.displayName}
                  onChange={(e) => patch({ displayName: e.target.value })} placeholder="Priya Sharma" />
              </div>
              {!userId && (
                <div>
                  <label className={label}>Username</label>
                  <input className={clsx(input, "mt-1.5")} value={form.username}
                    onChange={(e) => patch({ username: e.target.value })} placeholder="priya" />
                </div>
              )}
              <div>
                <label className={label}>{userId ? "New password (leave blank to keep the current one)" : "Password"}</label>
                <div className="relative mt-1.5">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" className={clsx(input, "pl-9")} value={form.password}
                    onChange={(e) => patch({ password: e.target.value })} placeholder="At least 6 characters" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Team</label>
                  <input className={clsx(input, "mt-1.5")} value={form.team}
                    onChange={(e) => patch({ team: e.target.value })} placeholder="North" />
                </div>
                <div>
                  <label className={label}>Reports to</label>
                  <select className={clsx(input, "mt-1.5")} value={form.managerId}
                    onChange={(e) => patch({ managerId: e.target.value })}>
                    <option value="">Nobody</option>
                    {managers.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                  </select>
                </div>
              </div>
              {numbers.length > 1 && (
                <div className="rounded-xl border p-4">
                  <div className="text-sm font-medium">WhatsApp numbers</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {form.phoneNumberIds.length === 0
                      ? "Every number — they see the whole inbox."
                      : `Only the ${form.phoneNumberIds.length} ticked. Conversations on other numbers are invisible to them.`}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {numbers.map((n) => (
                      <label key={n.phoneNumberId}
                        className="flex items-center gap-2.5 text-sm cursor-pointer rounded-lg px-2 py-1.5 hover:bg-muted">
                        <input type="checkbox" checked={form.phoneNumberIds.includes(n.phoneNumberId)}
                          onChange={() => toggleNumber(n.phoneNumberId)} />
                        <span className="flex-1">{n.label || n.displayPhoneNumber}</span>
                        <span className="text-[11px] text-muted-foreground">{n.displayPhoneNumber}</span>
                      </label>
                    ))}
                  </div>
                  {form.phoneNumberIds.length > 0 && (
                    <button className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 mt-2"
                      onClick={() => patch({ phoneNumberIds: [] })}>
                      Give them every number
                    </button>
                  )}
                </div>
              )}

              {userId && (
                <div className="flex items-center justify-between rounded-xl border px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">Active</div>
                    <div className="text-xs text-muted-foreground">Deactivated users cannot sign in</div>
                  </div>
                  <button onClick={() => patch({ isActive: !form.isActive })}
                    className={clsx("w-11 h-6 rounded-full relative transition-colors", form.isActive ? "bg-primary" : "bg-muted")}>
                    <span className={clsx("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all", form.isActive ? "left-[22px]" : "left-0.5")} />
                  </button>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold">Role</h2>
              <div className="grid gap-2.5">
                {(["ADMIN", "RM", "SALES"] as const).map((r) => (
                  <button key={r}
                    onClick={() => patch({ role: r, permissions: form.usesRoleDefaults ? [...(roleDefaults[r] || [])] : form.permissions })}
                    className={clsx("text-left rounded-xl border-2 px-4 py-3 transition-colors",
                      form.role === r ? "border-primary bg-accent" : "hover:bg-muted/60")}>
                    <div className="text-sm font-semibold">{r}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{ROLE_HINT[r]}</div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* permissions */}
        <aside className="w-[380px] shrink-0 border-l bg-muted/20 overflow-y-auto">
          <div className="p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">Permissions</h2>
              <span className="text-[11px] text-muted-foreground">{enabled} enabled</span>
              <div className="flex-1" />
              <button className="text-[11px] text-primary hover:underline" onClick={resetToRole}>
                Reset to {form.role}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 mb-3">
              {form.role === "ADMIN"
                ? "Admins always have every permission."
                : form.usesRoleDefaults
                  ? "Following the role defaults — toggle anything to customise."
                  : "Custom set — this user no longer follows the role defaults."}
            </p>

            <div className={clsx("space-y-3", form.role === "ADMIN" && "opacity-50 pointer-events-none")}>
              {groups.map((g) => (
                <div key={g.group} className="rounded-xl border bg-card overflow-hidden">
                  <div className="px-3 py-1.5 bg-muted/50 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.group}
                  </div>
                  <div className="divide-y">
                    {g.items.map((it) => {
                      const on = form.role === "ADMIN" || form.permissions.includes(it.key);
                      return (
                        <button key={it.key} onClick={() => togglePerm(it.key)}
                          className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-muted/40">
                          <span className={clsx("mt-0.5 w-8 h-[18px] rounded-full relative shrink-0 transition-colors", on ? "bg-primary" : "bg-muted")}>
                            <span className={clsx("absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all", on ? "left-[16px]" : "left-0.5")} />
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
        </aside>
      </div>
    </div>
  );
}
