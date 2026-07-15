import { and, avg, count, eq, inArray, sql } from "drizzle-orm";

import type { MonitorDetail, MonitorSummary } from "@changelens/contracts";
import type { DatabaseClient, MonitorRow } from "@changelens/database";
import { executions, extractionFields, monitors } from "@changelens/database";

interface MonitorStats {
  fieldCount: number;
  successRate: number;
  averageDurationMs: number | null;
}

export async function loadMonitorStats(
  database: DatabaseClient,
  monitorIds: string[],
): Promise<Map<string, MonitorStats>> {
  const stats = new Map<string, MonitorStats>();
  if (monitorIds.length === 0) return stats;

  const [fieldCounts, executionStats] = await Promise.all([
    database.db
      .select({ monitorId: extractionFields.monitorId, fieldCount: count() })
      .from(extractionFields)
      .where(inArray(extractionFields.monitorId, monitorIds))
      .groupBy(extractionFields.monitorId),
    database.db
      .select({
        monitorId: executions.monitorId,
        total: count(),
        succeeded: sql<number>`count(*) filter (where ${executions.status} = 'succeeded')`.mapWith(Number),
        averageDurationMs: avg(executions.durationMs).mapWith(Number),
      })
      .from(executions)
      .where(and(inArray(executions.monitorId, monitorIds), sql`${executions.trigger} <> 'preview'`))
      .groupBy(executions.monitorId),
  ]);

  const fieldsByMonitor = new Map(fieldCounts.map((row) => [row.monitorId, Number(row.fieldCount)]));
  const runsByMonitor = new Map(executionStats.map((row) => [row.monitorId, row]));

  for (const monitorId of monitorIds) {
    const runs = runsByMonitor.get(monitorId);
    const total = Number(runs?.total ?? 0);
    stats.set(monitorId, {
      fieldCount: fieldsByMonitor.get(monitorId) ?? 0,
      successRate: total > 0 ? Math.round((Number(runs?.succeeded ?? 0) / total) * 1_000) / 10 : 0,
      averageDurationMs: runs?.averageDurationMs == null ? null : Math.round(Number(runs.averageDurationMs)),
    });
  }

  return stats;
}

export function serializeMonitor(row: MonitorRow, stats?: MonitorStats): MonitorSummary {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    hostname: row.hostname,
    renderMode: row.renderMode,
    schedule: row.schedule,
    isActive: row.isActive,
    status: row.status,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastChangedAt: row.lastChangedAt?.toISOString() ?? null,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    successRate: stats?.successRate ?? 0,
    averageDurationMs: stats?.averageDurationMs ?? null,
    fieldCount: stats?.fieldCount ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getMonitorDetail(
  database: DatabaseClient,
  userId: string,
  monitorId: string,
): Promise<MonitorDetail | null> {
  const [monitor] = await database.db
    .select()
    .from(monitors)
    .where(and(eq(monitors.id, monitorId), eq(monitors.userId, userId)))
    .limit(1);
  if (!monitor) return null;

  const [fields, monitorStats] = await Promise.all([
    database.db
      .select()
      .from(extractionFields)
      .where(eq(extractionFields.monitorId, monitor.id))
      .orderBy(extractionFields.position),
    loadMonitorStats(database, [monitor.id]),
  ]);

  return {
    ...serializeMonitor(monitor, monitorStats.get(monitor.id)),
    webhookUrl: monitor.webhookUrl,
    retentionDays: monitor.retentionDays,
    fields: fields.map((field) => ({
      id: field.id,
      key: field.key,
      label: field.label,
      selector: field.selector,
      valueType: field.valueType,
      attribute: field.attribute,
      required: field.required,
      multiple: field.multiple,
      position: field.position,
    })),
  };
}
