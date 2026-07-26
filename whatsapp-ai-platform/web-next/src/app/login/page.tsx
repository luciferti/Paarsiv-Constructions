"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Loader2 } from "lucide-react";
import { api, setSession, setToken, type Session } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
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
      const res = await api.post<{ token: string } & Session>("/auth/login", {
        tenantSlug,
        username,
        password,
      });
      setToken(res.token);
      setSession({ user: res.user, tenant: res.tenant });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-sidebar text-sidebar-foreground p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(ellipse at 20% 10%, hsl(168 70% 30% / 0.5), transparent 55%), radial-gradient(ellipse at 90% 90%, hsl(200 70% 25% / 0.4), transparent 50%)" }} />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-white">WA Platform</span>
        </div>
        <div className="relative">
          <h1 className="text-4xl font-semibold text-white leading-tight">
            Every conversation.<br />One AI-first inbox.
          </h1>
          <p className="mt-4 text-sidebar-foreground max-w-md">
            Team inbox, AI replies, campaigns, journeys and analytics for WhatsApp Business — in one place.
          </p>
        </div>
        <p className="relative text-sm text-sidebar-foreground/70">Built on the Meta WhatsApp Cloud API</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">WA Platform</span>
          </div>

          <div>
            <h2 className="text-2xl font-semibold">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-1">Welcome back to your workspace</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Workspace</label>
              <input
                className="mt-1.5 w-full h-10 px-3 rounded-lg border bg-card text-sm outline-none focus:ring-2 focus:ring-ring"
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                placeholder="demo"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Username</label>
              <input
                className="mt-1.5 w-full h-10 px-3 rounded-lg border bg-card text-sm outline-none focus:ring-2 focus:ring-ring"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium">Password</label>
              <input
                type="password"
                className="mt-1.5 w-full h-10 px-3 rounded-lg border bg-card text-sm outline-none focus:ring-2 focus:ring-ring"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-xs text-muted-foreground">
            Demo: workspace <b>demo</b> · admin / ChangeMe!2026
          </p>
        </form>
      </div>
    </div>
  );
}
