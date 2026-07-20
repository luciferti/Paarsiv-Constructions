"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/layout/Logo";
import { clearSession, getUser, SessionUser } from "@/lib/auth/session";

const NAV_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Sites", href: "/sites" },
  { label: "Workers", href: "/workers" },
  { label: "Vendors", href: "/vendors" },
  { label: "Materials", href: "/materials" },
  { label: "Purchase Orders", href: "/purchase-orders" },
  { label: "Invoices", href: "/invoices" },
  { label: "Petty Cash", href: "/petty-cash" },
  { label: "Notifications", href: "/notifications" },
];

// Existing production HRMS modules — linked once this feature set is
// merged into the real repo; shown here so the shell reads as one product.
const HRMS_LINKS = ["Employees", "Attendance", "Payroll", "Leave"];

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, [pathname]);

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  return (
    <aside className="sidebar">
      <Wordmark href="/dashboard" />

      <nav className="nav-section">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-item${pathname?.startsWith(link.href) ? " active" : ""}`}
          >
            <span className="dot" aria-hidden="true" />
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="nav-section">
        <div className="nav-label">Workforce (HRMS)</div>
        {HRMS_LINKS.map((label) => (
          <span key={label} className="nav-item disabled" title="Available in the full HRMS">
            <span className="dot" aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>

      <div className="sidebar-foot">
        <div className="avatar">{user ? initials(user.name) : "?"}</div>
        <div>
          <div className="who">{user?.name ?? "—"}</div>
          <div className="role">
            {user?.role && user?.org_name
              ? `${user.role} · ${user.org_name}`
              : (user?.email ?? "")}
          </div>
        </div>
        <button type="button" className="sidebar-logout" onClick={handleLogout}>
          Exit
        </button>
      </div>
    </aside>
  );
}
