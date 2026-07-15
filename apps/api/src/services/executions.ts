import type { ExecutionSummary } from "@changelens/contracts";
import type { ExecutionRow } from "@changelens/database";

export function serializeExecution(
  execution: ExecutionRow,
  extra: { monitorName?: string | null; hasChanges?: boolean | null; changeCount?: number | null } = {},
): ExecutionSummary {
  return {
    id: execution.id,
    monitorId: execution.monitorId,
    monitorName: extra.monitorName ?? null,
    trigger: execution.trigger,
    status: execution.status,
    renderer: execution.renderer,
    requestedAt: execution.requestedAt.toISOString(),
    startedAt: execution.startedAt?.toISOString() ?? null,
    finishedAt: execution.finishedAt?.toISOString() ?? null,
    durationMs: execution.durationMs,
    attempt: execution.attempt,
    httpStatus: execution.httpStatus,
    finalUrl: execution.finalUrl,
    output: execution.output,
    hasChanges: extra.hasChanges ?? null,
    changeCount: extra.changeCount ?? null,
    screenshotAvailable: Boolean(execution.screenshotKey),
    errorCode: execution.errorCode,
    errorMessage: execution.errorMessage,
    blockedReason: execution.blockedReason,
    warnings: execution.warnings,
  };
}
