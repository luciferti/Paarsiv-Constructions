"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Wordmark } from "@/components/layout/Logo";

function BlueprintPlan() {
  return (
    <div className="auth-plan" aria-hidden="true">
      <svg viewBox="0 0 460 420" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="40" y="60" width="200" height="140" stroke="#4C6F94" strokeWidth="1.5" />
        <rect x="60" y="80" width="60" height="45" stroke="#3A567A" strokeWidth="1" />
        <rect x="140" y="80" width="80" height="45" stroke="#3A567A" strokeWidth="1" />
        <rect x="60" y="145" width="160" height="35" stroke="#3A567A" strokeWidth="1" />
        <line x1="40" y1="200" x2="240" y2="200" stroke="#F0A324" strokeWidth="1.5" strokeDasharray="4 3" />
        <rect x="260" y="120" width="150" height="220" stroke="#4C6F94" strokeWidth="1.5" />
        <line x1="260" y1="170" x2="410" y2="170" stroke="#3A567A" strokeWidth="1" />
        <line x1="260" y1="220" x2="410" y2="220" stroke="#3A567A" strokeWidth="1" />
        <line x1="260" y1="270" x2="410" y2="270" stroke="#3A567A" strokeWidth="1" />
        <line x1="335" y1="120" x2="335" y2="340" stroke="#3A567A" strokeWidth="1" />
        <circle cx="70" cy="250" r="3" fill="#F0A324" />
        <circle cx="130" cy="280" r="3" fill="#F0A324" />
        <circle cx="190" cy="255" r="3" fill="#F0A324" />
        <path d="M70 250 L130 280 L190 255" stroke="#F0A324" strokeWidth="1" strokeDasharray="2 3" />
        <text x="40" y="380" fill="#7D93AC" fontFamily="ui-monospace, monospace" fontSize="11">
          SITE-001 · RIVERSIDE TOWER
        </text>
        <text x="40" y="398" fill="#5A7392" fontFamily="ui-monospace, monospace" fontSize="10">
          SCALE 1:200 · REV C
        </text>
      </svg>
    </div>
  );
}

const SIGNUP_STEPS = [
  {
    title: "Create your account",
    body: "Company name, your name, and a work email.",
    done: true,
  },
  {
    title: "Add your first site",
    body: "Name, address, and who's managing it.",
    done: false,
  },
  {
    title: "Invite your team",
    body: "Supervisors and engineers get access by role.",
    done: false,
  },
];

function LoginPanel() {
  return (
    <>
      <BlueprintPlan />
      <div className="auth-left-foot">
        <p className="quote">
          &ldquo;The daily summary told us about a rebar shortage before our supervisor even
          called it in.&rdquo;
        </p>
        <p className="attribution">— SITE MANAGER, CONSTRUCTION PILOT</p>
      </div>
    </>
  );
}

function SignupPanel() {
  return (
    <>
      <div className="auth-steps">
        {SIGNUP_STEPS.map((step, index) => (
          <div key={step.title} className={`auth-step${step.done ? " done" : ""}`}>
            <div className="num">{step.done ? "✓" : index + 1}</div>
            <div>
              <h4>{step.title}</h4>
              <p>{step.body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="auth-left-foot">
        <p className="auth-steps-note">
          Already building on the platform? Sites, vendors and daily reports sync the moment your
          team logs in.
        </p>
      </div>
    </>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isSignup = pathname?.startsWith("/signup");

  return (
    <div className="auth-split">
      <div className="auth-left crop-marks">
        <span className="cm-tr" />
        <span className="cm-bl" />
        <div className="grid-navy" />
        <Wordmark label="HRMS · AI OPERATING SYSTEM" />
        {isSignup ? <SignupPanel /> : <LoginPanel />}
      </div>

      <div className="auth-right">
        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}
