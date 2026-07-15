"use client";

import { BellRing, Code2, Database, KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { UserAvatar } from "@/components/user-avatar";

const controls = [
  {
    icon: ShieldCheck,
    title: "Target safety",
    text: "SSRF validation, redirect checks, robots.txt and per-domain concurrency are enforced by workers.",
    tag: "Enforced",
  },
  {
    icon: Database,
    title: "Data retention",
    text: "Execution output and private captures are retained for 30 days by default.",
    tag: "30 days",
  },
  {
    icon: BellRing,
    title: "Webhook delivery",
    text: "Change events are signed with HMAC-SHA256 and retried with exponential backoff.",
    tag: "Signed",
  },
  {
    icon: KeyRound,
    title: "Session security",
    text: "Opaque sessions use strict cookies, CSRF protection and Argon2id password hashing.",
    tag: "Active",
  },
];

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <>
      <PageHeader
        title="Account and policies"
        description="Identity, security, retention and delivery defaults for this personal workspace."
      />

      {user && (
        <section className="panel account-panel">
          <div className="account-identity">
            <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={88} className="account-avatar" />
            <div>
              <span className="account-kicker">Workspace owner</span>
              <h2>{user.name}</h2>
              <p>Software engineering · AI · Automation</p>
            </div>
          </div>
          <div className="account-details">
            <a href={`mailto:${user.email}`}>
              <Mail size={15} />
              <span>
                <small>Email</small>
                <strong>{user.email}</strong>
              </span>
            </a>
            <a href="https://github.com/JMDcore" target="_blank" rel="noreferrer">
              <Code2 size={15} />
              <span>
                <small>GitHub</small>
                <strong>@JMDcore</strong>
              </span>
            </a>
            <div>
              <UserRound size={15} />
              <span>
                <small>Member since</small>
                <strong>
                  {new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(user.createdAt))}
                </strong>
              </span>
            </div>
          </div>
        </section>
      )}

      <div className="settings-grid">
        {controls.map(({ icon: Icon, title, text, tag }) => (
          <section className="panel settings-card" key={title}>
            <span className="settings-icon">
              <Icon size={18} />
            </span>
            <div>
              <div>
                <h2>{title}</h2>
                <span>{tag}</span>
              </div>
              <p>{text}</p>
            </div>
          </section>
        ))}
      </div>
      <section className="panel policy-detail">
        <div className="panel-header">
          <div>
            <h2>Responsible use policy</h2>
            <p>Non-configurable protections in the public MVP</p>
          </div>
        </div>
        <div className="policy-checklist">
          <span>✓ HTTP and HTTPS destinations only</span>
          <span>✓ Private and reserved networks blocked</span>
          <span>✓ Redirect destinations revalidated</span>
          <span>✓ Cloud metadata hosts denied</span>
          <span>✓ No CAPTCHA or anti-bot bypass</span>
          <span>✓ Identified ChangeLens user agent</span>
        </div>
      </section>
    </>
  );
}
