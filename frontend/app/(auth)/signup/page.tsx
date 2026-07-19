"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { signup } from "@/lib/api/auth";
import { setSession } from "@/lib/auth/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setApiError(null);

    const nextErrors: Record<string, string> = {};
    if (company.trim().length < 2) nextErrors.company = "Enter your company name";
    if (name.trim().length < 2) nextErrors.name = "Enter your full name";
    if (!EMAIL_RE.test(email)) nextErrors.email = "Enter a valid email address";
    if (password.length < 8) nextErrors.password = "Use at least 8 characters";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const auth = await signup({
        company_name: company.trim(),
        name: name.trim(),
        email,
        password,
      });
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
      <div className="eyebrow">Get started</div>
      <h1 className="auth-title">Create your account</h1>
      <p className="auth-subtitle">Set up your company workspace in under two minutes.</p>

      <form onSubmit={handleSubmit} className="auth-form" noValidate>
        {apiError && <p className="form-banner-error">{apiError}</p>}

        <div className="form-field">
          <label htmlFor="signup-company">Company name</label>
          <input
            id="signup-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Rajputana Builders Pvt. Ltd."
            aria-invalid={Boolean(errors.company)}
          />
          {errors.company && <p className="field-error">{errors.company}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="signup-name">Full Name</label>
          <input
            id="signup-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Shubham Tiwari"
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="signup-email">Work email</label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && <p className="field-error">{errors.email}</p>}
        </div>

        <div className="form-field">
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            aria-invalid={Boolean(errors.password)}
          />
          {errors.password && <p className="field-error">{errors.password}</p>}
        </div>

        <button type="submit" className="button-primary auth-submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </>
  );
}
