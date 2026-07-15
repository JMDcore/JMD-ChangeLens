"use client";

import { Activity, ArrowRight, Clock3, Plus, RefreshCw, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/app-shell";
import { ExecutionTable } from "@/components/execution-table";
import { MonitorTable } from "@/components/monitor-table";
import { getDashboard, getMonitors, type DashboardData } from "@/lib/api";
import type { MonitorSummary } from "@changelens/contracts";

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [monitors, setMonitors] = useState<MonitorSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [nextDashboard, nextMonitors] = await Promise.all([getDashboard(), getMonitors()]);
      setDashboard(nextDashboard);
      setMonitors(nextMonitors);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load operational data");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <>
      <PageHeader
        eyebrow="Live workspace"
        title="Operations overview"
        description="Monitor extraction health, changes and queue activity across your public web targets."
        actions={
          <>
            <button className="button button-quiet" onClick={load} disabled={refreshing}>
              <RefreshCw size={14} className={refreshing ? "spin" : ""} />
              Refresh
            </button>
            <Link href="/monitors/new" className="button button-primary">
              <Plus size={15} />
              New monitor
            </Link>
          </>
        }
      />

      {error && <div className="error-banner">{error}</div>}
      {!dashboard ? (
        <DashboardSkeleton />
      ) : (
        <>
          <section className="kpi-rail" aria-label="Key metrics">
            <div className="kpi-primary">
              <span className="kpi-icon">
                <Workflow size={17} />
              </span>
              <div>
                <small>Active monitors</small>
                <strong>{dashboard.overview.monitorCount - dashboard.overview.pausedCount}</strong>
              </div>
              <span className="metric-delta positive">+2 this week</span>
            </div>
            <div>
              <small>Success rate · 24h</small>
              <strong>
                {dashboard.overview.successRate24h.toFixed(1)}
                <em>%</em>
              </strong>
              <span className="mini-bars" aria-hidden="true">
                {[6, 8, 5, 9, 8, 10, 9, 11, 10, 12].map((height, index) => (
                  <i key={index} style={{ height }} />
                ))}
              </span>
            </div>
            <div>
              <small>Changes detected · 24h</small>
              <strong>{dashboard.overview.changes24h}</strong>
              <span className="metric-note">
                <Sparkles size={11} />3 require review
              </span>
            </div>
            <div>
              <small>Average duration</small>
              <strong>
                {(dashboard.overview.averageDurationMs24h / 1000).toFixed(1)}
                <em>s</em>
              </strong>
              <span className="metric-note">
                <Clock3 size={11} />
                across {dashboard.overview.runs24h} runs
              </span>
            </div>
            <div className="health-summary">
              <span className="health-ring">
                97<small>%</small>
              </span>
              <div>
                <small>System health</small>
                <strong>Operational</strong>
                <span>API, workers and storage</span>
              </div>
            </div>
          </section>

          <div className="operations-grid">
            <section className="panel monitors-panel">
              <div className="panel-header">
                <div>
                  <h2>Monitors</h2>
                  <p>Latest state across configured targets</p>
                </div>
                <Link href="/monitors" className="panel-link">
                  View all <ArrowRight size={11} />
                </Link>
              </div>
              <MonitorTable monitors={monitors.slice(0, 4)} />
            </section>

            <aside className="ops-side-stack">
              <section className="panel queue-panel">
                <div className="panel-header">
                  <div>
                    <h2>Queue activity</h2>
                    <p>Extraction jobs right now</p>
                  </div>
                  <span className="live-indicator">
                    <i />
                    live
                  </span>
                </div>
                <div className="queue-visual">
                  <div className="queue-track">
                    <span style={{ width: "18%" }} />
                    <span style={{ width: "26%" }} />
                    <span style={{ width: "38%" }} />
                    <span style={{ width: "18%" }} />
                  </div>
                  <div className="queue-stats">
                    <div>
                      <span className="queue-dot waiting" />
                      <small>Waiting</small>
                      <strong>{dashboard.queue.waiting}</strong>
                    </div>
                    <div>
                      <span className="queue-dot active" />
                      <small>Active</small>
                      <strong>{dashboard.queue.active}</strong>
                    </div>
                    <div>
                      <span className="queue-dot delayed" />
                      <small>Delayed</small>
                      <strong>{dashboard.queue.delayed}</strong>
                    </div>
                    <div>
                      <span className="queue-dot failed" />
                      <small>Failed</small>
                      <strong>{dashboard.queue.failed}</strong>
                    </div>
                  </div>
                </div>
                <div className="worker-strip">
                  <Activity size={13} />
                  <span>2 workers online</span>
                  <b>concurrency 4</b>
                </div>
              </section>

              <section className="panel change-preview">
                <div className="panel-header">
                  <div>
                    <h2>Latest change</h2>
                    <p>Lumina desk lamp · 8 min ago</p>
                  </div>
                  <span className="change-badge">2 fields</span>
                </div>
                <div className="diff-preview">
                  <div>
                    <span className="diff-sign removed">−</span>
                    <small>price</small>
                    <code>129.00</code>
                  </div>
                  <div>
                    <span className="diff-sign added">+</span>
                    <small>price</small>
                    <code>109.00</code>
                  </div>
                  <div>
                    <span className="diff-sign removed">−</span>
                    <small>availability</small>
                    <code>In stock</code>
                  </div>
                  <div>
                    <span className="diff-sign added">+</span>
                    <small>availability</small>
                    <code>Only 4 left</code>
                  </div>
                </div>
                <Link href={`/monitors/${monitors[0]?.id ?? ""}`} className="change-review">
                  <ShieldCheck size={13} />
                  Review captured change <ArrowRight size={12} />
                </Link>
              </section>
            </aside>
          </div>

          <section className="panel recent-runs-panel">
            <div className="panel-header">
              <div>
                <h2>Recent runs</h2>
                <p>Background execution timeline</p>
              </div>
              <Link href="/runs" className="panel-link">
                Open run explorer <ArrowRight size={11} />
              </Link>
            </div>
            <ExecutionTable executions={dashboard.recentExecutions.slice(0, 5)} />
          </section>
        </>
      )}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton">
      <div className="skeleton" />
      <div>
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    </div>
  );
}
