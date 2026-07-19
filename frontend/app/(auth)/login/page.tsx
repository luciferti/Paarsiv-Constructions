"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { login } from "@/lib/api/auth";
import { setSession } from "@/lib/auth/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setApiError(null);

    const nextErrors: Record<string, string> = {};
    if (!EMAIL_RE.test(email)) nextErrors.email = "Enter a valid email address";
    if (password.length < 1) nextErrors.password = "Password is required";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const auth = await login({ email, password });
      setSession(auth.access_token, {
        name: auth.user.name,
        email: auth.user.email,
        role: auth.user.role,
        org_name: auth.org_name,
      });
      router.push("/dashboard");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="eyebrow">Welcome back</div>
      <h1 className="auth-title">Log in to your account</h1>
      <p className="auth-subtitle">
        Track sites, materials, vendors and daily reports in one place.
      </p>

      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        {apiError && <p className="form-banner-error">{apiError}</p>}

        <div className="form-field">
          <label htmlFor="login-email">Work email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && <p className="field-error">{errors.email}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
          />
          {errors.password && <p className="field-error">{errors.password}</p>}
        </div>

        <button type="submit" className="button-primary auth-submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Log In"}
        </button>
      </form>

      <p className="auth-switch">
        Don&apos;t have an account? <Link href="/signup">Sign up</Link>
      </p>
    </>
  );
}
