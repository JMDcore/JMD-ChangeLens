import { and, count, desc, eq, ilike } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import {
  createMonitorSchema,
  createPreviewSchema,
  idParameterSchema,
  monitorQuerySchema,
  updateMonitorSchema,
} from "@changelens/contracts";
import { auditLogs, executions, extractionFields, monitors } from "@changelens/database";
import { enqueueExecution, removeMonitorSchedule, syncMonitorSchedule } from "@changelens/queue";
import { assertPublicHttpUrl } from "@changelens/scraper";

import { AppError, notFound, parseInput } from "../lib/errors.js";
import { getMonitorDetail, loadMonitorStats, serializeMonitor } from "../services/monitors.js";
import type { ApiDependencies } from "../types.js";

async function validateDestinations(
  url: string,
  webhookUrl?: string | null,
): Promise<{ url: URL; webhookUrl: URL | null }> {
  const safeUrl = await assertPublicHttpUrl(url);
  const safeWebhook = webhookUrl ? await assertPublicHttpUrl(webhookUrl) : null;
  return { url: safeUrl, webhookUrl: safeWebhook };
}

export async function registerMonitorRoutes(app: FastifyInstance, dependencies: ApiDependencies): Promise<void> {
  app.get("/api/monitors", { preHandler: app.authenticate }, async (request) => {
    const user = request.authUser!;
    const query = parseInput(monitorQuerySchema, request.query);
    const conditions = [eq(monitors.userId, user.id)];
    if (query.search) conditions.push(ilike(monitors.name, `%${query.search}%`));
    if (query.active) conditions.push(eq(monitors.isActive, query.active === "true"));
    const where = and(...conditions);
    const offset = (query.page - 1) * query.pageSize;

    const [rows, totalRows] = await Promise.all([
      dependencies.database.db
        .select()
        .from(monitors)
        .where(where)
        .orderBy(desc(monitors.updatedAt))
        .limit(query.pageSize)
        .offset(offset),
      dependencies.database.db.select({ total: count() }).from(monitors).where(where),
    ]);
    const stats = await loadMonitorStats(
      dependencies.database,
      rows.map((monitor) => monitor.id),
    );
    const total = Number(totalRows[0]?.total ?? 0);
    return {
      data: rows.map((monitor) => serializeMonitor(monitor, stats.get(monitor.id))),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
    };
  });

  app.post("/api/monitors", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.authUser!;
    const input = parseInput(createMonitorSchema, request.body);
    const destinations = await validateDestinations(input.url, input.webhookUrl);

    const created = await dependencies.database.db.transaction(async (transaction) => {
      const [monitor] = await transaction
        .insert(monitors)
        .values({
          userId: user.id,
          name: input.name,
          url: destinations.url.toString(),
          hostname: destinations.url.hostname,
          renderMode: input.renderMode,
          schedule: input.schedule,
          isActive: input.isActive,
          status: input.isActive ? "pending" : "paused",
          webhookUrl: destinations.webhookUrl?.toString() ?? null,
          retentionDays: input.retentionDays,
        })
        .returning();
      if (!monitor) throw new AppError(500, "MONITOR_CREATION_FAILED", "The monitor could not be created");
      await transaction.insert(extractionFields).values(
        input.fields.map((field, position) => ({
          monitorId: monitor.id,
          key: field.key,
          label: field.label,
          selector: field.selector,
          valueType: field.valueType,
          attribute: field.attribute ?? null,
          required: field.required,
          multiple: field.multiple,
          position,
        })),
      );
      return monitor;
    });

    try {
      const nextRunAt = await syncMonitorSchedule(dependencies.queues.extractions, created);
      if (nextRunAt) {
        await dependencies.database.db
          .update(monitors)
          .set({ nextRunAt, updatedAt: new Date() })
          .where(eq(monitors.id, created.id));
      }
    } catch (cause) {
      await dependencies.database.db.delete(monitors).where(eq(monitors.id, created.id));
      throw new AppError(503, "QUEUE_UNAVAILABLE", "The monitor could not be scheduled; no data was retained", {
        cause: cause instanceof Error ? cause.message : "Unknown queue error",
      });
    }

    await dependencies.database.db.insert(auditLogs).values({
      userId: user.id,
      action: "monitor.create",
      entityType: "monitor",
      entityId: created.id,
      requestId: request.id,
      metadata: { hostname: created.hostname, schedule: created.schedule },
    });
    return reply.code(201).send({ monitor: await getMonitorDetail(dependencies.database, user.id, created.id) });
  });

  app.post("/api/previews", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.authUser!;
    const input = parseInput(createPreviewSchema, request.body);
    const safeUrl = await assertPublicHttpUrl(input.url);
    const [execution] = await dependencies.database.db
      .insert(executions)
      .values({
        userId: user.id,
        monitorId: null,
        trigger: "preview",
        status: "queued",
        input: {
          url: safeUrl.toString(),
          renderMode: input.renderMode,
          fields: input.fields.map((field) => ({
            key: field.key,
            label: field.label,
            selector: field.selector,
            valueType: field.valueType,
            attribute: field.attribute,
            required: field.required,
            multiple: field.multiple,
          })),
        },
      })
      .returning({ id: executions.id });
    if (!execution) throw new AppError(500, "PREVIEW_CREATION_FAILED", "The preview could not be created");

    try {
      await enqueueExecution(dependencies.queues.extractions, { executionId: execution.id, userId: user.id });
    } catch (cause) {
      await dependencies.database.db.delete(executions).where(eq(executions.id, execution.id));
      throw new AppError(503, "QUEUE_UNAVAILABLE", "The preview could not be queued", {
        cause: cause instanceof Error ? cause.message : "Unknown queue error",
      });
    }
    return reply.code(202).send({ executionId: execution.id, status: "queued" });
  });

  app.get("/api/monitors/:id", { preHandler: app.authenticate }, async (request) => {
    const { id } = parseInput(idParameterSchema, request.params);
    const monitor = await getMonitorDetail(dependencies.database, request.authUser!.id, id);
    if (!monitor) throw notFound("Monitor");
    return { monitor };
  });

  app.patch("/api/monitors/:id", { preHandler: app.authenticate }, async (request) => {
    const user = request.authUser!;
    const { id } = parseInput(idParameterSchema, request.params);
    const input = parseInput(updateMonitorSchema, request.body);
    const [existing] = await dependencies.database.db
      .select()
      .from(monitors)
      .where(and(eq(monitors.id, id), eq(monitors.userId, user.id)))
      .limit(1);
    if (!existing) throw notFound("Monitor");

    const safeUrl = input.url ? await assertPublicHttpUrl(input.url) : new URL(existing.url);
    const webhookWasProvided = Object.prototype.hasOwnProperty.call(input, "webhookUrl");
    const safeWebhook =
      typeof input.webhookUrl === "string"
        ? await assertPublicHttpUrl(input.webhookUrl)
        : webhookWasProvided
          ? null
          : existing.webhookUrl
            ? new URL(existing.webhookUrl)
            : null;
    const now = new Date();

    const [updated] = await dependencies.database.db.transaction(async (transaction) => {
      const values = {
        name: input.name ?? existing.name,
        url: safeUrl.toString(),
        hostname: safeUrl.hostname,
        renderMode: input.renderMode ?? existing.renderMode,
        schedule: input.schedule ?? existing.schedule,
        isActive: input.isActive ?? existing.isActive,
        status: (input.isActive ?? existing.isActive) ? existing.status : ("paused" as const),
        webhookUrl: safeWebhook?.toString() ?? null,
        retentionDays: input.retentionDays ?? existing.retentionDays,
        updatedAt: now,
      };
      const rows = await transaction.update(monitors).set(values).where(eq(monitors.id, id)).returning();
      if (input.fields) {
        await transaction.delete(extractionFields).where(eq(extractionFields.monitorId, id));
        await transaction.insert(extractionFields).values(
          input.fields.map((field, position) => ({
            monitorId: id,
            key: field.key,
            label: field.label,
            selector: field.selector,
            valueType: field.valueType,
            attribute: field.attribute ?? null,
            required: field.required,
            multiple: field.multiple,
            position,
          })),
        );
      }
      return rows;
    });
    if (!updated) throw notFound("Monitor");

    const nextRunAt = await syncMonitorSchedule(dependencies.queues.extractions, updated);
    await dependencies.database.db
      .update(monitors)
      .set({ nextRunAt, updatedAt: now })
      .where(eq(monitors.id, updated.id));
    await dependencies.database.db.insert(auditLogs).values({
      userId: user.id,
      action: "monitor.update",
      entityType: "monitor",
      entityId: updated.id,
      requestId: request.id,
    });
    return { monitor: await getMonitorDetail(dependencies.database, user.id, updated.id) };
  });

  app.delete("/api/monitors/:id", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.authUser!;
    const { id } = parseInput(idParameterSchema, request.params);
    const [existing] = await dependencies.database.db
      .select({ id: monitors.id })
      .from(monitors)
      .where(and(eq(monitors.id, id), eq(monitors.userId, user.id)))
      .limit(1);
    if (!existing) throw notFound("Monitor");

    const screenshotRows = await dependencies.database.db
      .select({ key: executions.screenshotKey })
      .from(executions)
      .where(eq(executions.monitorId, id));
    await Promise.all(screenshotRows.flatMap(({ key }) => (key ? [dependencies.screenshots.delete(key)] : [])));
    await removeMonitorSchedule(dependencies.queues.extractions, id);
    await dependencies.database.db.transaction(async (transaction) => {
      await transaction.delete(monitors).where(eq(monitors.id, id));
      await transaction.insert(auditLogs).values({
        userId: user.id,
        action: "monitor.delete",
        entityType: "monitor",
        entityId: id,
        requestId: request.id,
      });
    });
    return reply.code(204).send();
  });

  app.post("/api/monitors/:id/run", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.authUser!;
    const { id } = parseInput(idParameterSchema, request.params);
    const monitor = await getMonitorDetail(dependencies.database, user.id, id);
    if (!monitor) throw notFound("Monitor");
    const [execution] = await dependencies.database.db
      .insert(executions)
      .values({
        monitorId: id,
        userId: user.id,
        trigger: "manual",
        status: "queued",
        input: {
          url: monitor.url,
          renderMode: monitor.renderMode,
          fields: monitor.fields.map((field) => ({
            key: field.key,
            label: field.label,
            selector: field.selector,
            valueType: field.valueType,
            attribute: field.attribute,
            required: field.required,
            multiple: field.multiple,
          })),
        },
      })
      .returning({ id: executions.id });
    if (!execution) throw new AppError(500, "EXECUTION_CREATION_FAILED", "The execution could not be created");

    try {
      await enqueueExecution(dependencies.queues.extractions, { executionId: execution.id, userId: user.id });
    } catch (cause) {
      await dependencies.database.db.delete(executions).where(eq(executions.id, execution.id));
      throw new AppError(503, "QUEUE_UNAVAILABLE", "The execution could not be queued", {
        cause: cause instanceof Error ? cause.message : "Unknown queue error",
      });
    }
    await dependencies.database.db.insert(auditLogs).values({
      userId: user.id,
      action: "execution.enqueue",
      entityType: "monitor",
      entityId: id,
      requestId: request.id,
    });
    return reply.code(202).send({ executionId: execution.id, status: "queued" });
  });
}
