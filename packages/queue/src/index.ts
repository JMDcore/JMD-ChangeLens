import { scheduleIntervalMs, type SchedulePreset } from "@changelens/contracts";
import { Queue, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";

export const EXTRACTION_QUEUE = "changelens:extractions";
export const ALERT_QUEUE = "changelens:alerts";
export const EXECUTION_JOB = "run-extraction";
export const SCHEDULED_JOB = "scheduled-extraction";
export const WEBHOOK_JOB = "deliver-webhook";

// BullMQ currently types scheduler identifiers as the job name generic, so this
// must remain string to support stable monitor:{uuid} scheduler IDs.
export type ExtractionJobName = string;
export type AlertJobName = string;

export type ExtractionJobData =
  | { kind: "execution"; executionId: string; userId: string }
  | { kind: "scheduled"; monitorId: string; userId: string; executionId?: string };

export interface AlertJobData {
  deliveryId: string;
  executionId: string;
  monitorId: string;
  userId: string;
}

export type ExtractionQueue = Queue<
  ExtractionJobData,
  void,
  ExtractionJobName,
  ExtractionJobData,
  void,
  ExtractionJobName
>;
export type AlertQueue = Queue<AlertJobData, void, AlertJobName, AlertJobData, void, AlertJobName>;

export const extractionJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 60 * 60, count: 2_000 },
};

export const alertJobOptions: JobsOptions = {
  attempts: 4,
  backoff: { type: "exponential", delay: 10_000 },
  removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
  removeOnFail: { age: 14 * 24 * 60 * 60, count: 2_000 },
};

export function schedulerId(monitorId: string): string {
  return `monitor:${monitorId}`;
}

export interface ChangeLensQueues {
  connection: Redis;
  extractions: ExtractionQueue;
  alerts: AlertQueue;
  close: () => Promise<void>;
}

export function createQueues(redisUrl: string, connectionName = "changelens-queue"): ChangeLensQueues {
  const connection = new Redis(redisUrl, {
    connectionName,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  const extractions = new Queue<ExtractionJobData, void, ExtractionJobName, ExtractionJobData, void, ExtractionJobName>(
    EXTRACTION_QUEUE,
    { connection },
  );
  const alerts = new Queue<AlertJobData, void, AlertJobName, AlertJobData, void, AlertJobName>(ALERT_QUEUE, {
    connection,
  });

  return {
    connection,
    extractions,
    alerts,
    close: async () => {
      await Promise.all([extractions.close(), alerts.close()]);
      await connection.quit();
    },
  };
}

export async function enqueueExecution(
  queue: ExtractionQueue,
  input: { executionId: string; userId: string },
): Promise<void> {
  await queue.add(
    EXECUTION_JOB,
    { kind: "execution", ...input },
    { ...extractionJobOptions, jobId: input.executionId },
  );
}

export async function enqueueWebhook(queue: AlertQueue, data: AlertJobData): Promise<void> {
  await queue.add(WEBHOOK_JOB, data, { ...alertJobOptions, jobId: data.deliveryId });
}

export async function syncMonitorSchedule(
  queue: ExtractionQueue,
  monitor: { id: string; userId: string; schedule: SchedulePreset; isActive: boolean },
): Promise<Date | null> {
  const id = schedulerId(monitor.id);
  const every = scheduleIntervalMs[monitor.schedule];

  if (!monitor.isActive || every === null) {
    await queue.removeJobScheduler(id);
    return null;
  }

  await queue.upsertJobScheduler(
    id,
    { every },
    {
      name: SCHEDULED_JOB,
      data: { kind: "scheduled", monitorId: monitor.id, userId: monitor.userId },
      opts: extractionJobOptions,
    },
  );

  const scheduler = await queue.getJobScheduler(id);
  return scheduler?.next ? new Date(scheduler.next) : null;
}

export async function removeMonitorSchedule(queue: ExtractionQueue, monitorId: string): Promise<void> {
  await queue.removeJobScheduler(schedulerId(monitorId));
}
