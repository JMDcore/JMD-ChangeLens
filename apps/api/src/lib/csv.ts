import type { StructuredOutput } from "@changelens/contracts";

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const serialized = Array.isArray(value) || typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n\r]/u.test(serialized) ? `"${serialized.replaceAll('"', '""')}"` : serialized;
}

export function executionsToCsv(
  executions: Array<{ id: string; requestedAt: Date; durationMs: number | null; output: StructuredOutput | null }>,
): string {
  const fieldNames = [
    ...new Set(executions.flatMap((execution) => (execution.output ? Object.keys(execution.output) : []))),
  ].sort();
  const headers = ["execution_id", "requested_at", "duration_ms", ...fieldNames];
  const rows = executions.map((execution) => [
    execution.id,
    execution.requestedAt.toISOString(),
    execution.durationMs,
    ...fieldNames.map((field) => execution.output?.[field] ?? null),
  ]);
  return `${headers.map(escapeCsv).join(",")}\n${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}\n`;
}
