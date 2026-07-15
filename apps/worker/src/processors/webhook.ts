import { createHmac } from "node:crypto";

import { and, eq } from "drizzle-orm";
import type { Job } from "bullmq";
import type { Logger } from "pino";

import type { WorkerEnvironment } from "@changelens/config";
import type { DatabaseClient } from "@changelens/database";
import { alertDeliveries, changes, executions, monitors } from "@changelens/database";
import type { AlertJobData } from "@changelens/queue";
import { assertPublicHttpUrl } from "@changelens/scraper";

import type { WorkerMetrics } from "../observability.js";

export interface WebhookProcessorDependencies {
  env: WorkerEnvironment;
  database: DatabaseClient;
  logger: Logger;
  metrics: WorkerMetrics;
}

export function buildWebhookSignature(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

async function postWithSafeRedirects(
  inputUrl: string,
  body: string,
  headers: Record<string, string>,
  maxRedirects = 3,
): Promise<Response> {
  let url = await assertPublicHttpUrl(inputUrl);
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location || redirects === maxRedirects) throw new Error("Webhook exceeded the safe redirect limit");
    url = await assertPublicHttpUrl(new URL(location, url));
  }
  throw new Error("Webhook redirect policy failed");
}

export function createWebhookProcessor(dependencies: WebhookProcessorDependencies) {
  return async (job: Job<AlertJobData>): Promise<void> => {
    const [delivery] = await dependencies.database.db
      .select()
      .from(alertDeliveries)
      .where(eq(alertDeliveries.id, job.data.deliveryId))
      .limit(1);
    const [execution] = await dependencies.database.db
      .select()
      .from(executions)
      .where(and(eq(executions.id, job.data.executionId), eq(executions.userId, job.data.userId)))
      .limit(1);
    const [monitor] = await dependencies.database.db
      .select()
      .from(monitors)
      .where(and(eq(monitors.id, job.data.monitorId), eq(monitors.userId, job.data.userId)))
      .limit(1);
    const [change] = await dependencies.database.db
      .select()
      .from(changes)
      .where(eq(changes.executionId, job.data.executionId))
      .limit(1);

    if (!delivery || !execution || !monitor || !change || !monitor.webhookUrl) {
      if (delivery) {
        await dependencies.database.db
          .update(alertDeliveries)
          .set({ status: "skipped", errorMessage: "Monitor, execution, change, or destination no longer exists" })
          .where(eq(alertDeliveries.id, delivery.id));
      }
      dependencies.metrics.webhookJobs.inc({ status: "skipped" });
      return;
    }

    const payload = JSON.stringify({
      id: delivery.id,
      event: "monitor.changed",
      createdAt: new Date().toISOString(),
      monitor: { id: monitor.id, name: monitor.name, url: monitor.url },
      execution: {
        id: execution.id,
        requestedAt: execution.requestedAt.toISOString(),
        durationMs: execution.durationMs,
        output: execution.output,
      },
      change: change.summary,
    });
    const signature = buildWebhookSignature(payload, dependencies.env.WEBHOOK_SIGNING_SECRET);
    const attempt = job.attemptsMade + 1;

    try {
      const response = await postWithSafeRedirects(monitor.webhookUrl, payload, {
        "content-type": "application/json",
        "user-agent": dependencies.env.CHANGELENS_USER_AGENT,
        "x-changelens-delivery": delivery.id,
        "x-changelens-event": "monitor.changed",
        "x-changelens-signature": signature,
      });
      await response.body?.cancel();
      if (!response.ok) throw new Error(`Webhook destination responded with HTTP ${response.status}`);

      await dependencies.database.db
        .update(alertDeliveries)
        .set({
          status: "delivered",
          attempt,
          responseStatus: response.status,
          errorMessage: null,
          deliveredAt: new Date(),
        })
        .where(eq(alertDeliveries.id, delivery.id));
      dependencies.metrics.webhookJobs.inc({ status: "delivered" });
      dependencies.logger.info({ deliveryId: delivery.id, responseStatus: response.status }, "Webhook delivered");
    } catch (error) {
      await dependencies.database.db
        .update(alertDeliveries)
        .set({
          status: "failed",
          attempt,
          errorMessage: error instanceof Error ? error.message : "Unknown webhook error",
        })
        .where(eq(alertDeliveries.id, delivery.id));
      dependencies.metrics.webhookJobs.inc({ status: "failed" });
      dependencies.logger.warn({ error, deliveryId: delivery.id, attempt }, "Webhook delivery failed");
      throw error;
    }
  };
}
