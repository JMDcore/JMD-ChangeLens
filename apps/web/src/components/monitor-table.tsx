"use client";

import type { MonitorSummary, SchedulePreset } from "@changelens/contracts";
import { Clock3, ExternalLink, Globe2, MoreHorizontal } from "lucide-react";
import Link from "next/link";

import { StatusPill } from "./status-pill";
import { formatDuration, formatRelativeTime } from "./time";

const scheduleLabel: Record<SchedulePreset, string> = {
  manual: "Manual",
  every_15m: "Every 15 min",
  hourly: "Hourly",
  every_6h: "Every 6 hours",
  daily: "Daily",
};

export function MonitorTable({ monitors, compact = false }: { monitors: MonitorSummary[]; compact?: boolean }) {
  return (
    <div className="table-scroll">
      <table className="data-table monitor-table">
        <thead>
          <tr>
            <th>Monitor</th>
            <th>Status</th>
            <th>Schedule</th>
            {!compact && <th>Success</th>}
            <th>Last run</th>
            {!compact && <th>Avg. duration</th>}
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {monitors.map((monitor) => (
            <tr key={monitor.id}>
              <td>
                <Link href={`/monitors/${monitor.id}`} className="monitor-identity">
                  <span className="target-icon">
                    <Globe2 size={14} />
                  </span>
                  <span>
                    <strong>{monitor.name}</strong>
                    <small>
                      {monitor.hostname}
                      <ExternalLink size={9} />
                    </small>
                  </span>
                </Link>
              </td>
              <td>
                <StatusPill status={monitor.status} />
              </td>
              <td>
                <span className="schedule-cell">
                  <Clock3 size={12} />
                  {scheduleLabel[monitor.schedule]}
                </span>
              </td>
              {!compact && (
                <td>
                  <span className={monitor.successRate < 95 ? "metric-warning mono" : "mono"}>
                    {monitor.successRate.toFixed(1)}%
                  </span>
                </td>
              )}
              <td>
                <span className="time-cell">
                  {formatRelativeTime(monitor.lastRunAt)}
                  <small>{monitor.nextRunAt ? `next ${formatRelativeTime(monitor.nextRunAt)}` : "not scheduled"}</small>
                </span>
              </td>
              {!compact && <td className="mono muted">{formatDuration(monitor.averageDurationMs)}</td>}
              <td>
                <button className="row-action" aria-label={`Actions for ${monitor.name}`}>
                  <MoreHorizontal size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
