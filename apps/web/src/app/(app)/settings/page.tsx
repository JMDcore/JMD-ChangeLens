import { BellRing, Database, KeyRound, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/app-shell";

const controls = [
  {
    icon: ShieldCheck,
    title: "Target safety",
    text: "SSRF validation, redirect checks, robots.txt and per-domain concurrency are enforced by workers.",
    tag: "enforced",
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
    tag: "signed",
  },
  {
    icon: KeyRound,
    title: "Session security",
    text: "Opaque sessions use strict cookies, CSRF protection and Argon2id password hashing.",
    tag: "active",
  },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Workspace policy"
        title="Settings"
        description="Security, retention and delivery defaults for the personal workspace."
      />
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
