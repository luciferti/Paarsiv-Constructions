"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

import { AssistantWidget } from "@/components/assistant/AssistantWidget";
import { Sidebar } from "@/components/layout/Sidebar";
import { getToken } from "@/lib/auth/session";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setChecked(true);
  }, [router]);

  if (!checked) return null;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">{children}</main>
      <AssistantWidget />
    </div>
  );
}
