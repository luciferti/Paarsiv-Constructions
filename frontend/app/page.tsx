"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Footer } from "@/components/layout/Footer";
import { Wordmark } from "@/components/layout/Logo";
import { getToken } from "@/lib/auth/session";

const FEATURES = [
  { title: "Site Management", body: "Track every site, its team, and status in one place." },
  { title: "AI Daily Summaries", body: "Turn daily site reports into a digest, automatically." },
  { title: "Invoice OCR", body: "Read vendor invoices and reconcile them against orders." },
];

export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(Boolean(getToken()));
  }, []);

  return (
    <div className="landing-shell">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Wordmark label="HRMS · AI OPERATING SYSTEM" />
          <div className="landing-nav-actions">
            {loggedIn ? (
              <Link href="/dashboard" className="button-primary">
                Open Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="login-link">
                  Log in
                </Link>
                <Link href="/signup" className="button-primary">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="hero crop-marks">
          <span className="cm-tr" />
          <span className="cm-bl" />
          <div className="grid-navy" />
          <div className="hero-inner">
            <span className="eyebrow">Built for construction teams</span>
            <h1 className="hero-title">
              The AI Operating System for <span className="hero-accent">Construction</span>
            </h1>
            <p className="hero-subtitle">
              Built on your existing HRMS. Site, material, and vendor management — with AI doing
              the busywork.
            </p>
            <div className="hero-actions">
              <Link href={loggedIn ? "/dashboard" : "/signup"} className="button-primary hero-cta">
                {loggedIn ? "Go to Dashboard" : "Get Started"}
              </Link>
              {!loggedIn && (
                <Link href="/login" className="hero-secondary-cta">
                  Log In
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="feature-grid">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="feature-card">
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </div>
          ))}
        </section>
      </main>

      <Footer />
    </div>
  );
}
