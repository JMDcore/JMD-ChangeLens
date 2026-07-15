import { and, count, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { executionQuerySchema, idParameterSchema } from "@changelens/contracts";
import { changes, executions, monitors } from "@changelens/database";

import { executionsToCsv } from "../lib/csv.js";
import { notFound, parseInput } from "../lib/errors.js";
import { serializeExecution } from "../services/executions.js";
import type { ApiDependencies } from "../types.js";

const exportQuerySchema = z.object({ format: z.enum(["json", "csv"]).default("json") });

function safeFilename(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/(^-|-$)/gu, "") || "monitor"
  );
}

export async function registerExecutionRoutes(app: FastifyInstance, dependencies: ApiDependencies): Promise<void> {
  app.get("/api/executions", { preHandler: app.authenticate }, async (request) => {
    const user = request.authUser!;
    const query = parseInput(executionQuerySchema, request.query);
    const conditions = [eq(executions.userId, user.id)];
    if (query.monitorId) conditions.push(eq(executions.monitorId, query.monitorId));
    if (query.status) conditions.push(eq(executions.status, query.status));
    const where = and(...conditions);
    const offset = (query.page - 1) * query.pageSize;

    const [rows, totalRows] = await Promise.all([
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
        .where(where)
        .orderBy(desc(executions.requestedAt))
        .limit(query.pageSize)
        .offset(offset),
      dependencies.database.db.select({ total: count() }).from(executions).where(where),
    ]);
    const total = Number(totalRows[0]?.total ?? 0);
    return {
      data: rows.map((row) =>
        serializeExecution(row.execution, {
          monitorName: row.monitorName,
          hasChanges: row.hasChanges,
          changeCount: row.changeCount,
        }),
      ),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
    };
  });

  app.get("/api/executions/:id", { preHandler: app.authenticate }, async (request) => {
    const user = request.authUser!;
    const { id } = parseInput(idParameterSchema, request.params);
    const [row] = await dependencies.database.db
      .select({
        execution: executions,
        monitorName: monitors.name,
        hasChanges: changes.hasChanges,
        changeCount: changes.changeCount,
        changeSummary: changes.summary,
        previousExecutionId: changes.previousExecutionId,
      })
      .from(executions)
      .leftJoin(monitors, eq(executions.monitorId, monitors.id))
      .leftJoin(changes, eq(executions.id, changes.executionId))
      .where(and(eq(executions.id, id), eq(executions.userId, user.id)))
      .limit(1);
    if (!row) throw notFound("Execution");

    const [previous] = row.previousExecutionId
      ? await dependencies.database.db
          .select({ id: executions.id, output: executions.output, requestedAt: executions.requestedAt })
          .from(executions)
          .where(and(eq(executions.id, row.previousExecutionId), eq(executions.userId, user.id)))
          .limit(1)
      : [];

    return {
      execution: serializeExecution(row.execution, {
        monitorName: row.monitorName,
        hasChanges: row.hasChanges,
        changeCount: row.changeCount,
      }),
      change: row.changeSummary
        ? {
            summary: row.changeSummary,
            previousExecution: previous
              ? { id: previous.id, output: previous.output, requestedAt: previous.requestedAt.toISOString() }
              : null,
          }
        : null,
      logs: row.execution.logs,
    };
  });

  app.get("/api/executions/:id/screenshot", { preHandler: app.authenticate }, async (request, reply) => {
    const { id } = parseInput(idParameterSchema, request.params);
    const [execution] = await dependencies.database.db
      .select({ key: executions.screenshotKey, contentType: executions.screenshotContentType })
      .from(executions)
      .where(and(eq(executions.id, id), eq(executions.userId, request.authUser!.id)))
      .limit(1);
    if (!execution?.key) throw notFound("Screenshot");

    const screenshot = await dependencies.screenshots.get(execution.key);
    reply.header("content-type", execution.contentType ?? screenshot.contentType);
    reply.header("cache-control", "private, max-age=300");
    if (screenshot.etag) reply.header("etag", screenshot.etag);
    return reply.send(Buffer.from(screenshot.body));
  });

  app.get("/api/monitors/:id/export", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.authUser!;
    const { id } = parseInput(idParameterSchema, request.params);
    const query = parseInput(exportQuerySchema, request.query);
    const [monitor] = await dependencies.database.db
      .select({ id: monitors.id, name: monitors.name, url: monitors.url })
      .from(monitors)
      .where(and(eq(monitors.id, id), eq(monitors.userId, user.id)))
      .limit(1);
    if (!monitor) throw notFound("Monitor");

    const rows = await dependencies.database.db
      .select({
        id: executions.id,
        requestedAt: executions.requestedAt,
        durationMs: executions.durationMs,
        output: executions.output,
      })
      .from(executions)
      .where(and(eq(executions.monitorId, monitor.id), eq(executions.status, "succeeded")))
      .orderBy(desc(executions.requestedAt));
    const filename = `${safeFilename(monitor.name)}-history.${query.format}`;
    reply.header("content-disposition", `attachment; filename="${filename}"`);

    if (query.format === "csv") {
      reply.header("content-type", "text/csv; charset=utf-8");
      return executionsToCsv(rows);
    }
    reply.header("content-type", "application/json; charset=utf-8");
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        monitor,
        executions: rows.map((row) => ({ ...row, requestedAt: row.requestedAt.toISOString() })),
      },
      null,
      2,
    );
  });
}
