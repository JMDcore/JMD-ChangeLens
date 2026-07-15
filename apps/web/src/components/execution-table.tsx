import type { ExecutionSummary } from "@changelens/contracts";
import { ArrowDownUp, Bot, Braces, MoreHorizontal, Radio, UserRound } from "lucide-react";
import Link from "next/link";

import { StatusPill } from "./status-pill";
import { formatDuration, formatRelativeTime } from "./time";

export function ExecutionTable({
  executions,
  showMonitor = true,
}: {
  executions: ExecutionSummary[];
  showMonitor?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table className="data-table execution-table">
        <thead>
          <tr>
            {showMonitor && <th>Monitor</th>}
            <th>Trigger</th>
            <th>Status</th>
            <th>Renderer</th>
            <th>Changes</th>
            <th>Duration</th>
            <th>Started</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {executions.map((execution) => (
            <tr key={execution.id}>
              {showMonitor && (
                <td>
                  <Link
                    className="run-monitor"
                    href={execution.monitorId ? `/monitors/${execution.monitorId}` : "/runs"}
                  >
                    <strong>{execution.monitorName ?? "Preview"}</strong>
                    <small className="mono">{execution.id.slice(0, 8)}</small>
                  </Link>
                </td>
              )}
              <td>
                <span className="trigger-cell">
                  {execution.trigger === "scheduled" ? (
                    <Radio size={12} />
                  ) : execution.trigger === "manual" ? (
                    <UserRound size={12} />
                  ) : (
                    <Braces size={12} />
                  )}
                  {execution.trigger}
                </span>
              </td>
              <td>
                <StatusPill status={execution.status} />
              </td>
              <td>
                <span className="renderer-cell">
                  {execution.renderer === "playwright" ? <Bot size={12} /> : <Braces size={12} />}
                  {execution.renderer ?? "—"}
                </span>
              </td>
              <td>
                {execution.hasChanges ? (
                  <span className="change-count">
                    <ArrowDownUp size={11} />
                    {execution.changeCount}
                  </span>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td className="mono">{formatDuration(execution.durationMs)}</td>
              <td>
                <span className="time-cell">
                  {formatRelativeTime(execution.requestedAt)}
                  <small>{execution.attempt > 1 ? `${execution.attempt} attempts` : "first attempt"}</small>
                </span>
              </td>
              <td>
                <button className="row-action" aria-label="Execution actions">
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
