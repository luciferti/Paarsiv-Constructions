import type { ReactNode } from "react";

import "./globals.css";

export const metadata = {
  title: "HRMS — AI Business OS",
};

/**
 * Standalone shell for previewing this feature set. In the real HRMS
 * repo, replace the Sidebar/auth guard here with the existing app
 * shell and session handling.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
