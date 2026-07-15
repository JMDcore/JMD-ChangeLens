import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { changes, executions, monitors } from "@changelens/database";

import { serializeExecution } from "../services/executions.js";
import type { ApiDependencies } from "../types.js";

export async function registerDashboardRoutes(app: FastifyInstance, dependencies: ApiDependencies): Promise<void> {
  app.get("/api/dashboard", { preHandler: app.authenticate }, async (request) => {
    const userId = request.authUser!.id;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1_000);

    const [statusRows, runRows, changeRows, recentRows, queueCounts] = await Promise.all([
      dependencies.database.db
        .select({ status: monitors.status, total: count() })
        .from(monitors)
        .where(eq(monitors.userId, userId))
        .groupBy(monitors.status),
      dependencies.database.db
        .select({
          total: count(),
          succeeded: sql<number>`count(*) filter (where ${executions.status} = 'succeeded')`.mapWith(Number),
          averageDurationMs:
            sql<number>`coalesce(avg(${executions.durationMs}) filter (where ${executions.status} = 'succeeded'), 0)`.mapWith(
              Number,
            ),
        })
        .from(executions)
        .where(and(eq(executions.userId, userId), gte(executions.requestedAt, since))),
      dependencies.database.db
        .select({ total: count() })
        .from(changes)
        .innerJoin(executions, eq(changes.executionId, executions.id))
        .where(and(eq(executions.userId, userId), eq(changes.hasChanges, true), gte(changes.createdAt, since))),
      dependencies.database.db
        .select({
          execution: executions,
          monitorName: monitors.name,
          hasChanges: changes.hasChanges,
          changeCount: changes.changeCount,
        })
        .from(executions)
        .leftJoin(monitors, eq(executions.monitorId, monitors.id))
        .leftJoin(changes, eq(executions.id, changes.executionId))
        .where(eq(executions.userId, userId))
        .orderBy(desc(executions.requestedAt))
        .limit(8),
      dependencies.queues.extractions.getJobCounts("waiting", "active", "delayed", "failed"),
    ]);

    const statuses = Object.fromEntries(statusRows.map((row) => [row.status, Number(row.total)]));
    const runs = runRows[0];
    const runTotal = Number(runs?.total ?? 0);
    return {
      overview: {
        monitorCount: Object.values(statuses).reduce((sum, value) => sum + value, 0),
        healthyCount: statuses.healthy ?? 0,
        changedCount: statuses.changed ?? 0,
        failingCount: statuses.failing ?? 0,
        pausedCount: statuses.paused ?? 0,
        runs24h: runTotal,
        successRate24h: runTotal > 0 ? Math.round((Number(runs?.succeeded ?? 0) / runTotal) * 1_000) / 10 : 0,
        averageDurationMs24h: Math.round(Number(runs?.averageDurationMs ?? 0)),
        changes24h: Number(changeRows[0]?.total ?? 0),
      },
      queue: {
        waiting: queueCounts.waiting ?? 0,
        active: queueCounts.active ?? 0,
        delayed: queueCounts.delayed ?? 0,
        failed: queueCounts.failed ?? 0,
      },
      recentExecutions: recentRows.map((row) =>
        serializeExecution(row.execution, {
          monitorName: row.monitorName,
          hasChanges: row.hasChanges,
          changeCount: row.changeCount,
        }),
      ),
    };
  });
}
