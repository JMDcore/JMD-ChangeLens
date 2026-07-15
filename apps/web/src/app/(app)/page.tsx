"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, PauseCircle, Plus, RefreshCw } from "lucide-react";
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
        title="Monitoring overview"
        description="Health, changes and background activity across your public targets."
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
            <div>
              <small>Active monitors</small>
              <strong>{dashboard.overview.monitorCount - dashboard.overview.pausedCount}</strong>
              <span className="metric-note">{dashboard.overview.monitorCount} configured</span>
            </div>
            <div>
              <small>Success rate · 24h</small>
              <strong>
                {dashboard.overview.successRate24h.toFixed(1)}
                <em>%</em>
              </strong>
              <span className="metric-note">{dashboard.overview.runs24h} runs in the last 24h</span>
            </div>
            <div>
              <small>Changes detected · 24h</small>
              <strong>{dashboard.overview.changes24h}</strong>
              <span className="metric-note">Across all active monitors</span>
            </div>
            <div>
              <small>Average duration</small>
              <strong>
                {(dashboard.overview.averageDurationMs24h / 1000).toFixed(1)}
                <em>s</em>
              </strong>
              <span className="metric-note">
                <Clock3 size={11} />
                Successful executions
              </span>
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
                  <span className="data-badge">Current snapshot</span>
                </div>
                <div className="queue-visual">
                  <div className="queue-track">
                    {[
                      dashboard.queue.waiting,
                      dashboard.queue.active,
                      dashboard.queue.delayed,
                      dashboard.queue.failed,
                    ].map((count, index, values) => (
                      <span
                        key={index}
                        style={{
                          width: `${
                            (count /
                              Math.max(
                                1,
                                values.reduce((sum, value) => sum + value, 0),
                              )) *
                            100
                          }%`,
                        }}
                      />
                    ))}
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
              </section>

              <section className="panel monitor-health-panel">
                <div className="panel-header">
                  <div>
                    <h2>Monitor health</h2>
                    <p>Current state of configured targets</p>
                  </div>
                  <span className="data-badge">{dashboard.overview.monitorCount} total</span>
                </div>
                <div className="health-list">
                  <div>
                    <span className="health-icon healthy">
                      <CheckCircle2 size={15} />
                    </span>
                    <span>Healthy</span>
                    <strong>{dashboard.overview.healthyCount}</strong>
                  </div>
                  <div>
                    <span className="health-icon changed">
                      <RefreshCw size={15} />
                    </span>
                    <span>Changed</span>
                    <strong>{dashboard.overview.changedCount}</strong>
                  </div>
                  <div>
                    <span className="health-icon failing">
                      <AlertTriangle size={15} />
                    </span>
                    <span>Failing</span>
                    <strong>{dashboard.overview.failingCount}</strong>
                  </div>
                  <div>
                    <span className="health-icon paused">
                      <PauseCircle size={15} />
                    </span>
                    <span>Paused</span>
                    <strong>{dashboard.overview.pausedCount}</strong>
                  </div>
                </div>
                <Link href="/monitors" className="health-review">
                  Review monitor inventory <ArrowRight size={12} />
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
