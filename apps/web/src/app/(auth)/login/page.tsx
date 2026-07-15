"use client";

import { ArrowRight, CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Brand } from "@/components/brand";
import { ApiClientError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signIn } = useAuth();
  const [email, setEmail] = useState("demo@changelens.dev");
  const [password, setPassword] = useState("ChangeLensDemo!2026");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, router, user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      router.push("/");
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : "Could not sign in. Check that the API is running.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-layout">
      <section className="auth-product">
        <Brand />
        <div className="auth-product-copy">
          <span className="eyebrow">Operational web intelligence</span>
          <h1>
            See the web change.
            <br />
            Know what changed.
          </h1>
          <p>
            Extract structured data, schedule safe browser jobs and inspect every change from one operational workspace.
          </p>
          <div className="auth-feature-list">
            <span>
              <CheckCircle2 size={15} /> CSS extraction with browser fallback
            </span>
            <span>
              <ShieldCheck size={15} /> SSRF and domain policy enforcement
            </span>
            <span>
              <KeyRound size={15} /> Private runs, screenshots and signed alerts
            </span>
          </div>
        </div>
        <div className="auth-terminal" aria-hidden="true">
          <div>
            <span className="terminal-dot red" />
            <span className="terminal-dot amber" />
            <span className="terminal-dot green" />
          </div>
          <code>
            <i>15:42:08</i> queue · execution accepted
          </code>
          <code>
            <i>15:42:09</i> policy · robots allowed
          </code>
          <code>
            <i>15:42:12</i> extract · 3 fields resolved
          </code>
          <code className="terminal-success">
            <i>15:42:12</i> change · price 129 → 109
          </code>
        </div>
      </section>

      <section className="auth-form-side">
        <form className="auth-form" onSubmit={submit}>
          <div>
            <span className="auth-kicker">Welcome back</span>
            <h2>Sign in to ChangeLens</h2>
            <p>Continue to your monitoring workspace.</p>
          </div>
          {error && <div className="auth-error">{error}</div>}
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
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button className="button button-primary auth-submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"} <ArrowRight size={15} />
          </button>
          <div className="demo-credentials">
            <strong>Portfolio demo</strong>
            <span>Credentials are pre-filled after running the demo seed.</span>
          </div>
          <p className="auth-switch">
            New to ChangeLens? <Link href="/register">Create an account</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
