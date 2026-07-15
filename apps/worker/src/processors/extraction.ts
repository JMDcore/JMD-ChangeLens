import { createHash } from "node:crypto";

import { and, desc, eq, lt, ne, sql } from "drizzle-orm";
import type { Job } from "bullmq";
import { UnrecoverableError } from "bullmq";
import type { Logger } from "pino";

import { buildChangeSet, canonicalize, type ChangeSet, type StructuredOutput } from "@changelens/contracts";
import type { WorkerEnvironment } from "@changelens/config";
import type {
  DatabaseClient,
  ExecutionInputSnapshot,
  ExecutionLogEntry,
  ExecutionRow,
  MonitorRow,
} from "@changelens/database";
import { alertDeliveries, changes, executions, extractionFields, monitors } from "@changelens/database";
import { enqueueWebhook, type ChangeLensQueues, type ExtractionJobData } from "@changelens/queue";
import { runExtraction, ScrapeError } from "@changelens/scraper";
import type { ScreenshotStore } from "@changelens/storage";

import { acquireDomainLease } from "../domain-policy.js";
import type { WorkerMetrics } from "../observability.js";

export interface ExtractionProcessorDependencies {
  env: WorkerEnvironment;
  database: DatabaseClient;
  queues: ChangeLensQueues;
  screenshots: ScreenshotStore;
  logger: Logger;
  metrics: WorkerMetrics;
}

interface ExecutionContext {
  execution: ExecutionRow;
  monitor: MonitorRow | null;
  input: ExecutionInputSnapshot;
}

const baselineChangeSet: ChangeSet = {
  hasChanges: false,
  changeCount: 0,
  added: 0,
  removed: 0,
  changed: 0,
  entries: [],
};

function contentHash(output: StructuredOutput): string {
  return createHash("sha256").update(canonicalize(output)).digest("hex");
}

async function loadMonitorInput(database: DatabaseClient, monitor: MonitorRow): Promise<ExecutionInputSnapshot> {
  const fields = await database.db
    .select()
    .from(extractionFields)
    .where(eq(extractionFields.monitorId, monitor.id))
    .orderBy(extractionFields.position);
  return {
    url: monitor.url,
    renderMode: monitor.renderMode,
    fields: fields.map((field) => ({
      key: field.key,
      label: field.label,
      selector: field.selector,
      valueType: field.valueType,
      attribute: field.attribute,
      required: field.required,
      multiple: field.multiple,
    })),
  };
}

async function resolveExecutionContext(
  job: Job<ExtractionJobData>,
  dependencies: ExtractionProcessorDependencies,
): Promise<ExecutionContext | null> {
  let executionId = job.data.kind === "execution" ? job.data.executionId : job.data.executionId;

  if (job.data.kind === "scheduled" && !executionId) {
    const [monitor] = await dependencies.database.db
      .select()
      .from(monitors)
      .where(
        and(eq(monitors.id, job.data.monitorId), eq(monitors.userId, job.data.userId), eq(monitors.isActive, true)),
      )
      .limit(1);
    if (!monitor) {
      dependencies.logger.warn({ jobId: job.id, monitorId: job.data.monitorId }, "Skipped orphaned scheduled job");
      return null;
    }

    const input = await loadMonitorInput(dependencies.database, monitor);
    const [created] = await dependencies.database.db
      .insert(executions)
      .values({
        monitorId: monitor.id,
        userId: monitor.userId,
        trigger: "scheduled",
        status: "queued",
        input,
      })
      .returning();
    if (!created) throw new Error("Could not create the scheduled execution record");
    executionId = created.id;
    await job.updateData({ ...job.data, executionId });
  }

  if (!executionId) return null;
  const [execution] = await dependencies.database.db
    .select()
    .from(executions)
    .where(and(eq(executions.id, executionId), eq(executions.userId, job.data.userId)))
    .limit(1);
  if (!execution) throw new UnrecoverableError("Execution no longer exists or belongs to another user");

  const [monitor] = execution.monitorId
    ? await dependencies.database.db
        .select()
        .from(monitors)
        .where(and(eq(monitors.id, execution.monitorId), eq(monitors.userId, execution.userId)))
        .limit(1)
    : [];
  const input = execution.input ?? (monitor ? await loadMonitorInput(dependencies.database, monitor) : null);
  if (!input || input.fields.length === 0) throw new UnrecoverableError("Execution has no extraction configuration");
  return { execution, monitor: monitor ?? null, input };
}

async function applyRetention(
  dependencies: ExtractionProcessorDependencies,
  monitor: MonitorRow,
  currentExecutionId: string,
): Promise<void> {
  const cutoff = new Date(Date.now() - monitor.retentionDays * 24 * 60 * 60 * 1_000);
  const expired = await dependencies.database.db
    .select({ id: executions.id, screenshotKey: executions.screenshotKey })
    .from(executions)
    .where(
      and(
        eq(executions.monitorId, monitor.id),
        ne(executions.id, currentExecutionId),
        lt(executions.requestedAt, cutoff),
      ),
    );
  if (expired.length === 0) return;

  await dependencies.database.db
    .delete(executions)
    .where(
      and(
        eq(executions.monitorId, monitor.id),
        ne(executions.id, currentExecutionId),
        lt(executions.requestedAt, cutoff),
      ),
    );
  await Promise.allSettled(
    expired
      .map((execution) => execution.screenshotKey)
      .filter((key): key is string => Boolean(key))
      .map((key) => dependencies.screenshots.delete(key)),
  );
}

export function createExtractionProcessor(dependencies: ExtractionProcessorDependencies) {
  return async (job: Job<ExtractionJobData>): Promise<void> => {
    const context = await resolveExecutionContext(job, dependencies);
    if (!context || context.execution.status === "succeeded") return;

    const startedAt = new Date();
    const attempt = job.attemptsMade + 1;
    const logs: ExecutionLogEntry[] = [
      {
        timestamp: startedAt.toISOString(),
        level: "info",
        message: "Extraction job started",
        context: { attempt, trigger: context.execution.trigger },
      },
    ];
    await dependencies.database.db
      .update(executions)
      .set({
        status: "running",
        startedAt,
        finishedAt: null,
        attempt,
        errorCode: null,
        errorMessage: null,
        blockedReason: null,
        logs,
      })
      .where(eq(executions.id, context.execution.id));

    const hostname = new URL(context.input.url).hostname;
    let lease: Awaited<ReturnType<typeof acquireDomainLease>> | null = null;
    const timerStarted = performance.now();

    try {
      lease = await acquireDomainLease(dependencies.queues.connection, hostname, {
        minimumDelayMs: dependencies.env.DOMAIN_MIN_DELAY_MS,
        leaseTtlMs: dependencies.env.CRAWL_TIMEOUT_MS + 20_000,
        acquisitionTimeoutMs: dependencies.env.CRAWL_TIMEOUT_MS + 20_000,
      });
      logs.push({ timestamp: new Date().toISOString(), level: "info", message: "Domain policy lease acquired" });

      const result = await runExtraction({
        ...context.input,
        userAgent: dependencies.env.CHANGELENS_USER_AGENT,
        timeoutMs: dependencies.env.CRAWL_TIMEOUT_MS,
        maxResponseBytes: dependencies.env.MAX_RESPONSE_BYTES,
        maxRedirects: dependencies.env.MAX_REDIRECTS,
      });
      const finishedAt = new Date();
      const durationMs = Math.round(finishedAt.getTime() - startedAt.getTime());
      logs.push({
        timestamp: finishedAt.toISOString(),
        level: "info",
        message: "Extraction completed",
        context: { renderer: result.renderer, durationMs, httpStatus: result.httpStatus },
      });

      let storedScreenshot: Awaited<ReturnType<ScreenshotStore["put"]>> | null = null;
      if (result.screenshot) {
        storedScreenshot = await dependencies.screenshots.put(
          context.execution.userId,
          context.execution.id,
          result.screenshot,
        );
      }

      const [previous] = context.execution.monitorId
        ? await dependencies.database.db
            .select({ id: executions.id, output: executions.output })
            .from(executions)
            .where(
              and(
                eq(executions.monitorId, context.execution.monitorId),
                eq(executions.status, "succeeded"),
                ne(executions.id, context.execution.id),
              ),
            )
            .orderBy(desc(executions.requestedAt))
            .limit(1)
        : [];
      const changeSet = previous?.output ? buildChangeSet(previous.output, result.output) : baselineChangeSet;
      const hash = contentHash(result.output);

      await dependencies.database.db.transaction(async (transaction) => {
        await transaction
          .update(executions)
          .set({
            status: "succeeded",
            renderer: result.renderer,
            output: result.output,
            normalizedHash: hash,
            screenshotKey: storedScreenshot?.key ?? null,
            screenshotContentType: storedScreenshot?.contentType ?? null,
            finishedAt,
            durationMs,
            httpStatus: result.httpStatus,
            finalUrl: result.finalUrl,
            warnings: result.warnings,
            logs,
          })
          .where(eq(executions.id, context.execution.id));

        if (context.execution.monitorId) {
          await transaction
            .insert(changes)
            .values({
              executionId: context.execution.id,
              previousExecutionId: previous?.id ?? null,
              hasChanges: changeSet.hasChanges,
              changeCount: changeSet.changeCount,
              summary: changeSet,
            })
            .onConflictDoUpdate({
              target: changes.executionId,
              set: {
                previousExecutionId: previous?.id ?? null,
                hasChanges: changeSet.hasChanges,
                changeCount: changeSet.changeCount,
                summary: changeSet,
              },
            });
          await transaction
            .update(monitors)
            .set({
              status: changeSet.hasChanges ? "changed" : "healthy",
              lastRunAt: finishedAt,
              ...(changeSet.hasChanges ? { lastChangedAt: finishedAt } : {}),
              consecutiveFailures: 0,
              updatedAt: finishedAt,
            })
            .where(eq(monitors.id, context.execution.monitorId));
        }
      });

      if (context.monitor) {
        await applyRetention(dependencies, context.monitor, context.execution.id);
        if (context.monitor.webhookUrl && changeSet.hasChanges) {
          const [delivery] = await dependencies.database.db
            .insert(alertDeliveries)
            .values({
              executionId: context.execution.id,
              destinationHost: new URL(context.monitor.webhookUrl).hostname,
              status: "queued",
            })
            .returning({ id: alertDeliveries.id });
          if (delivery) {
            try {
              await enqueueWebhook(dependencies.queues.alerts, {
                deliveryId: delivery.id,
                executionId: context.execution.id,
                monitorId: context.monitor.id,
                userId: context.monitor.userId,
              });
            } catch (error) {
              await dependencies.database.db
                .update(alertDeliveries)
                .set({ status: "failed", errorMessage: error instanceof Error ? error.message : "Queue failure" })
                .where(eq(alertDeliveries.id, delivery.id));
              dependencies.logger.error({ error, deliveryId: delivery.id }, "Could not enqueue webhook delivery");
            }
          }
        }
      }

      dependencies.metrics.extractionJobs.inc({ status: "succeeded", renderer: result.renderer });
      dependencies.metrics.extractionDuration.observe(
        { renderer: result.renderer },
        (performance.now() - timerStarted) / 1_000,
      );
      dependencies.logger.info(
        {
          jobId: job.id,
          executionId: context.execution.id,
          monitorId: context.execution.monitorId,
          renderer: result.renderer,
          durationMs,
          changeCount: changeSet.changeCount,
        },
        "Extraction job completed",
      );
    } catch (error) {
      const finishedAt = new Date();
      const scrapeError = error instanceof ScrapeError ? error : null;
      const maxAttempts = job.opts.attempts ?? 1;
      const willRetry = !scrapeError?.blocked && attempt < maxAttempts;
      const message = error instanceof Error ? error.message : "Unknown extraction error";
      const code = scrapeError?.code ?? "EXTRACTION_FAILED";
      logs.push({ timestamp: finishedAt.toISOString(), level: "error", message, context: { code, attempt } });

      await dependencies.database.db
        .update(executions)
        .set({
          status: willRetry ? "queued" : scrapeError?.blocked ? "blocked" : "failed",
          finishedAt: willRetry ? null : finishedAt,
          durationMs: Math.round(finishedAt.getTime() - startedAt.getTime()),
          errorCode: code,
          errorMessage: message,
          blockedReason: scrapeError?.blocked ? message : null,
          logs,
        })
        .where(eq(executions.id, context.execution.id));

      if (!willRetry && context.execution.monitorId) {
        await dependencies.database.db
          .update(monitors)
          .set({
            status: "failing",
            lastRunAt: finishedAt,
            consecutiveFailures: sql`${monitors.consecutiveFailures} + 1`,
            updatedAt: finishedAt,
          })
          .where(eq(monitors.id, context.execution.monitorId));
      }

      dependencies.metrics.extractionJobs.inc({
        status: scrapeError?.blocked ? "blocked" : "failed",
        renderer: "none",
      });
      dependencies.logger.warn(
        { error, jobId: job.id, executionId: context.execution.id, attempt, willRetry },
        "Extraction attempt failed",
      );
      if (scrapeError?.blocked) throw new UnrecoverableError(`${code}: ${message}`);
      throw error;
    } finally {
      await lease?.release();
    }
  };
}
