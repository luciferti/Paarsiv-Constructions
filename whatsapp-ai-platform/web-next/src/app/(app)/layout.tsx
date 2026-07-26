"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, MessageSquare, Users, FileText, Image as ImageIcon,
  Megaphone, GitBranch, BarChart3, UsersRound, Bot, LogOut, Moon, Sun,
  MessageCircle, Settings,
} from "lucide-react";
import clsx from "clsx";
import { getSession, setSession, setToken, type Session } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/media", label: "Media", icon: ImageIcon },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/journeys", label: "Journeys", icon: GitBranch },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/team", label: "Team", icon: UsersRound, roles: ["ADMIN", "RM"] },
  { href: "/ai", label: "AI Control", icon: Bot, roles: ["ADMIN"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["ADMIN"] },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setLocal] = useState<Session | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setLocal(s);
    setDark(document.documentElement.classList.contains("dark"));
  }, [router]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("wa_theme", next ? "dark" : "light");
  }

  function logout() {
    setToken(null);
    setSession(null);
    router.replace("/login");
  }

  if (!session) return null;
  const { user, tenant } = session;

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{tenant.name}</div>
            <div className="text-[11px] text-sidebar-foreground/70">WA Platform</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {NAV.filter((n) => !n.roles || n.roles.includes(user.role)).map((n) => {
            const active = pathname.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={clsx(
                  "flex items-center gap-3 px-3 h-9 rounded-lg text-[13px] font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-white"
                    : "hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className={clsx("w-[18px] h-[18px]", active && "text-primary")} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-1">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-semibold">
              {user.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-white truncate">{user.displayName}</div>
              <div className="text-[11px] text-sidebar-foreground/70">{user.role}</div>
            </div>
            <button onClick={toggleTheme} className="p-1.5 rounded-md hover:bg-white/10" title="Toggle theme">
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={logout} className="p-1.5 rounded-md hover:bg-white/10" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col">{children}</main>
    </div>
  );
}
