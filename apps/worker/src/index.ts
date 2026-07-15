import { Worker, type Job } from "bullmq";
import pino from "pino";

import { loadWorkerEnvironment } from "@changelens/config";
import { createDatabase } from "@changelens/database";
import {
  ALERT_QUEUE,
  createQueues,
  EXTRACTION_QUEUE,
  type AlertJobData,
  type ExtractionJobData,
} from "@changelens/queue";
import { ScreenshotStore } from "@changelens/storage";

import { createWorkerMetrics, startHealthServer } from "./observability.js";
import { createExtractionProcessor } from "./processors/extraction.js";
import { createWebhookProcessor } from "./processors/webhook.js";

const env = loadWorkerEnvironment();
const logger = pino({
  level: env.LOG_LEVEL,
  name: "changelens-worker",
  redact: {
    paths: ["webhookUrl", "url", "headers.authorization", "headers.cookie"],
    censor: "[REDACTED]",
  },
});
const database = createDatabase(env.DATABASE_URL);
const queues = createQueues(env.REDIS_URL, "changelens-worker");
const screenshots = new ScreenshotStore({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  bucket: env.S3_BUCKET,
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
});
const { metrics, registry } = createWorkerMetrics();
let ready = false;

if (queues.connection.status === "wait") await queues.connection.connect();
await Promise.all([database.pool.query("select 1"), queues.connection.ping(), screenshots.assertReady()]);

const extractionWorker = new Worker(
  EXTRACTION_QUEUE,
  createExtractionProcessor({ env, database, queues, screenshots, logger, metrics }) as (
    job: Job<ExtractionJobData>,
  ) => Promise<void>,
  {
    connection: queues.connection,
    concurrency: env.WORKER_CONCURRENCY,
    lockDuration: env.CRAWL_TIMEOUT_MS + 30_000,
    stalledInterval: 30_000,
    maxStalledCount: 1,
  },
);
const webhookWorker = new Worker(
  ALERT_QUEUE,
  createWebhookProcessor({ env, database, logger, metrics }) as (job: Job<AlertJobData>) => Promise<void>,
  {
    connection: queues.connection,
    concurrency: Math.max(2, env.WORKER_CONCURRENCY),
    lockDuration: 30_000,
  },
);
const healthServer = await startHealthServer(env.WORKER_HEALTH_PORT, registry, () => ready);

extractionWorker.on("error", (error) => logger.error({ error }, "Extraction worker error"));
extractionWorker.on("failed", (job, error) =>
  logger.warn({ error, jobId: job?.id, attemptsMade: job?.attemptsMade }, "Extraction job moved to failed"),
);
webhookWorker.on("error", (error) => logger.error({ error }, "Webhook worker error"));
webhookWorker.on("failed", (job, error) =>
  logger.warn({ error, jobId: job?.id, attemptsMade: job?.attemptsMade }, "Webhook job moved to failed"),
);

ready = true;
logger.info(
  { extractionConcurrency: env.WORKER_CONCURRENCY, healthPort: env.WORKER_HEALTH_PORT },
  "ChangeLens worker is ready",
);

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  ready = false;
  logger.info({ signal }, "Shutting down ChangeLens worker");
  await Promise.allSettled([extractionWorker.close(), webhookWorker.close(), healthServer.close()]);
  await Promise.allSettled([queues.close(), database.close()]);
  screenshots.destroy();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
