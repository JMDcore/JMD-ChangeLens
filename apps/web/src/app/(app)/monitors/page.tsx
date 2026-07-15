"use client";

import { Filter, Plus, Search, Workflow } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/app-shell";
import { MonitorTable } from "@/components/monitor-table";
import { getMonitors } from "@/lib/api";
import type { MonitorSummary } from "@changelens/contracts";

export default function MonitorsPage() {
  const [monitors, setMonitors] = useState<MonitorSummary[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMonitors()
      .then(setMonitors)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load monitors"))
      .finally(() => setLoading(false));
  }, []);

  const visibleMonitors = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return monitors.filter(
      (monitor) =>
        (status === "all" || monitor.status === status) &&
        (!normalized || `${monitor.name} ${monitor.hostname}`.toLowerCase().includes(normalized)),
    );
  }, [monitors, query, status]);

  return (
    <>
      <PageHeader
        eyebrow="Extraction fleet"
        title="Monitors"
        description="Configure targets, extraction rules and execution schedules from one operational view."
        actions={
          <Link className="button button-primary" href="/monitors/new">
            <Plus size={15} />
            New monitor
          </Link>
        }
      />

      <section className="panel listing-panel">
        <div className="listing-toolbar">
          <label className="table-search">
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by monitor or domain…"
            />
          </label>
          <label className="table-filter">
            <Filter size={13} />
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All states</option>
              <option value="healthy">Healthy</option>
              <option value="changed">Changed</option>
              <option value="failing">Failing</option>
              <option value="paused">Paused</option>
            </select>
          </label>
          <span className="result-count">
            {visibleMonitors.length} of {monitors.length} monitors
          </span>
        </div>
        {error ? (
          <div className="error-banner">{error}</div>
        ) : loading ? (
          <div className="list-skeleton skeleton" />
        ) : visibleMonitors.length ? (
          <MonitorTable monitors={visibleMonitors} />
        ) : (
          <div className="empty-state">
            <Workflow size={28} />
            <strong>No monitors match this view</strong>
            <span>Adjust the filters or configure a new public target.</span>
          </div>
        )}
      </section>
    </>
  );
}
