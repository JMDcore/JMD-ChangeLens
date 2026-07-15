"use client";

import {
  Activity,
  BookOpen,
  Gauge,
  LogOut,
  Menu,
  PanelLeftClose,
  Plus,
  Settings,
  ShieldCheck,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { useAuth } from "./auth-provider";
import { Brand } from "./brand";
import { UserAvatar } from "./user-avatar";

const navigation = [
  { href: "/", label: "Overview", icon: Gauge },
  { href: "/monitors", label: "Monitors", icon: Workflow },
  { href: "/runs", label: "Runs", icon: Activity },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <main className="boot-screen">
        <Brand />
        <div className="boot-line" />
        <span>Connecting to operations…</span>
      </main>
    );
  }

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const pageLabel = pathname.includes("/monitors/new")
    ? "New monitor"
    : pathname.startsWith("/monitors/")
      ? "Monitor detail"
      : pathname.startsWith("/settings")
        ? "Settings"
        : (navigation.find(({ href }) => active(href))?.label ?? "Workspace");

  return (
    <div className={`app-frame ${collapsed ? "is-collapsed" : ""}`}>
      <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`}>
        <div className="sidebar-head">
          <Brand compact={collapsed} />
          <button
            className="icon-button sidebar-close-mobile"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="workspace-switcher">
          <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={34} className="workspace-avatar" />
          {!collapsed && (
            <div>
              <strong>{user.name}</strong>
              <span>Personal workspace</span>
            </div>
          )}
        </div>

        <nav className="primary-nav" aria-label="Main navigation">
          {!collapsed && <span className="nav-section-label">Operations</span>}
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              href={href}
              key={href}
              className={active(href) ? "active" : ""}
              title={collapsed ? label : undefined}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={17} strokeWidth={1.8} />
              {!collapsed && <span>{label}</span>}
            </Link>
          ))}
          {!collapsed && <span className="nav-section-label secondary-label">Manage</span>}
          <Link
            href="/settings"
            title={collapsed ? "Settings" : undefined}
            className={active("/settings") ? "active" : ""}
          >
            <Settings size={17} strokeWidth={1.8} />
            {!collapsed && <span>Settings</span>}
          </Link>
        </nav>

        <div className="sidebar-foot">
          <a href="https://github.com/JMDcore/JMD-ChangeLens" target="_blank" rel="noreferrer" title="Documentation">
            <BookOpen size={16} />
            {!collapsed && <span>Documentation</span>}
          </a>
          <button className="collapse-button" onClick={() => setCollapsed((value) => !value)}>
            <PanelLeftClose size={16} />
            {!collapsed && <span>Collapse sidebar</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
      )}

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-context">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={19} />
            </button>
            <span className="context-parent">Workspace</span>
            <span className="context-slash">/</span>
            <strong>{pageLabel}</strong>
          </div>
          <div className="topbar-actions">
            <div className="system-state">
              <ShieldCheck size={14} /> Safe crawling policy
            </div>
            <div className="user-menu">
              <Link href="/settings" className="user-summary" aria-label="Open account settings">
                <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={34} />
                <span className="user-copy">
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </span>
              </Link>
              <button
                className="signout-quick"
                aria-label="Sign out"
                onClick={async () => {
                  await signOut();
                  router.push("/login");
                }}
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </header>

        <main className="content-area">{children}</main>

        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link href={href} key={href} className={active(href) ? "active" : ""}>
              <Icon size={19} />
              <span>{label}</span>
            </Link>
          ))}
          <Link href="/monitors/new" className="mobile-create">
            <Plus size={20} />
            <span>New</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
