import { useState } from "react";
import { api, setToken } from "../api";
import type { Tenant, User } from "../types";

interface Props {
  onLogin: (user: User, tenant: Tenant) => void;
}

export default function Login({ onLogin }: Props) {
  const [tenantSlug, setTenantSlug] = useState("demo");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: User; tenant: Tenant }>(
        "/auth/login",
        { tenantSlug, username, password }
      );
      setToken(res.token);
      onLogin(res.user, res.tenant);
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>WhatsApp AI Inbox</h1>
        <p className="sub">Sign in to your team workspace</p>

        <div className="field">
          <label>Workspace</label>
          <input value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} placeholder="demo" />
        </div>
        <div className="field">
          <label>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus placeholder="admin" />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <p className="err">{error}</p>}

        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="hint">
          Demo: workspace <b>demo</b> · admin / ChangeMe!2026 · priya, arjun, sana… / Demo@2026
        </p>
      </form>
    </div>
  );
}
