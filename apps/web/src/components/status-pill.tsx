import type { ExecutionStatus, MonitorStatus } from "@changelens/contracts";

const labels: Record<ExecutionStatus | MonitorStatus, string> = {
  blocked: "Blocked",
  changed: "Changed",
  failed: "Failed",
  failing: "Failing",
  healthy: "Healthy",
  paused: "Paused",
  pending: "Pending",
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
};

export function StatusPill({ status }: { status: ExecutionStatus | MonitorStatus }) {
  return (
    <span className={`status-pill status-${status}`}>
      <span className="status-dot" />
      {labels[status]}
    </span>
  );
}
