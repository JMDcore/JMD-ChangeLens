import { loadApiEnvironment } from "@changelens/config";
import { createDatabase } from "@changelens/database";
import { createQueues } from "@changelens/queue";
import { ScreenshotStore } from "@changelens/storage";

import { buildServer } from "./server.js";

const env = loadApiEnvironment();
const database = createDatabase(env.DATABASE_URL);
const queues = createQueues(env.REDIS_URL, "changelens-api");
const screenshots = new ScreenshotStore({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  bucket: env.S3_BUCKET,
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
});

const app = await buildServer({ env, database, queues, screenshots });
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "Shutting down ChangeLens API");
  await app.close();
  await Promise.allSettled([queues.close(), database.close()]);
  screenshots.destroy();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
} catch (error) {
  app.log.fatal({ error }, "ChangeLens API failed to start");
  await shutdown("startup_error");
  process.exitCode = 1;
}
