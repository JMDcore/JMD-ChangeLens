"use client";

import { Activity, Filter, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/app-shell";
import { ExecutionTable } from "@/components/execution-table";
import { getExecutions } from "@/lib/api";
import type { ExecutionSummary } from "@changelens/contracts";

export default function RunsPage() {
  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setExecutions(await getExecutions());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load execution history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visibleExecutions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return executions.filter(
      (execution) =>
        (status === "all" || execution.status === status) &&
        (!normalized || `${execution.monitorName ?? "preview"} ${execution.id}`.toLowerCase().includes(normalized)),
    );
  }, [executions, query, status]);

  return (
    <>
      <PageHeader
        eyebrow="Job explorer"
        title="Execution history"
        description="Inspect background jobs, renderers, retries, timings, changes and blocked decisions."
        actions={
          <button className="button button-quiet" disabled={loading} onClick={load}>
            <RefreshCw className={loading ? "spin" : ""} size={14} />
            Refresh
          </button>
        }
      />
      <section className="panel listing-panel">
        <div className="listing-toolbar">
          <label className="table-search">
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search run ID or monitor…"
            />
          </label>
          <label className="table-filter">
            <Filter size={13} />
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All states</option>
              <option value="succeeded">Succeeded</option>
              <option value="failed">Failed</option>
              <option value="blocked">Blocked</option>
              <option value="running">Running</option>
              <option value="queued">Queued</option>
            </select>
          </label>
          <span className="result-count">{visibleExecutions.length} runs</span>
        </div>
        {error ? (
          <div className="error-banner">{error}</div>
        ) : loading ? (
          <div className="list-skeleton skeleton" />
        ) : visibleExecutions.length ? (
          <ExecutionTable executions={visibleExecutions} />
        ) : (
          <div className="empty-state">
            <Activity size={28} />
            <strong>No runs match this view</strong>
            <span>Execution records will appear after a preview or monitor run.</span>
          </div>
        )}
      </section>
    </>
  );
}
