"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Brand } from "@/components/brand";
import { ApiClientError } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signUp(name, email, password);
      router.push("/");
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : "Could not create the account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-layout">
      <section className="auth-product compact-product">
        <Brand />
        <div className="auth-product-copy">
          <span className="eyebrow">Build a reliable signal</span>
          <h1>Monitor public data with an audit trail.</h1>
          <p>Every execution records its policy decision, renderer, duration, structured output and change set.</p>
        </div>
        <div className="policy-grid" aria-hidden="true">
          <span>
            robots.txt <b>enforced</b>
          </span>
          <span>
            private networks <b>blocked</b>
          </span>
          <span>
            domain rate <b>2.5 s</b>
          </span>
          <span>
            retention <b>30 days</b>
          </span>
        </div>
      </section>
      <section className="auth-form-side">
        <form className="auth-form" onSubmit={submit}>
          <div>
            <span className="auth-kicker">Create workspace</span>
            <h2>Start monitoring</h2>
            <p>Use public pages you are authorized to monitor.</p>
          </div>
          {error && <div className="auth-error">{error}</div>}
          <label>
            <span>Name</span>
            <input
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              required
            />
          </label>
          <label>
            <span>Email address</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={12}
              required
            />
            <small>At least 12 characters.</small>
          </label>
          <button className="button button-primary auth-submit" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"} <ArrowRight size={15} />
          </button>
          <p className="auth-switch">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
