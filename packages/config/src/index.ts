import { z } from "zod";

const booleanFromString = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}, z.boolean());

const commonSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
});

const storageSchema = z.object({
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1).default("eu-west-1"),
  S3_BUCKET: z.string().min(3).max(63).default("changelens-screenshots"),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanFromString.default(true),
});

const apiSchema = commonSchema.extend({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  COOKIE_SECURE: booleanFromString.default(false),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  METRICS_TOKEN: z.string().min(16),
  WEBHOOK_SIGNING_SECRET: z.string().min(32),
});

const workerSchema = commonSchema.extend({
  CHANGELENS_USER_AGENT: z.string().min(12).default("ChangeLensBot/0.1 (+https://github.com/JMDcore/JMD-ChangeLens)"),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65_535).default(4001),
  DOMAIN_MIN_DELAY_MS: z.coerce.number().int().min(1_000).max(60_000).default(2_500),
  CRAWL_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(30_000),
  MAX_RESPONSE_BYTES: z.coerce.number().int().min(100_000).max(20_000_000).default(5_242_880),
  MAX_REDIRECTS: z.coerce.number().int().min(0).max(10).default(5),
  BROWSER_MEMORY_MB: z.coerce.number().int().min(256).max(2_048).default(512),
  WEBHOOK_SIGNING_SECRET: z.string().min(32),
});

function parseEnvironment<T extends z.ZodType>(schema: T, source: NodeJS.ProcessEnv): z.infer<T> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;

  const details = result.error.issues
    .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid ChangeLens configuration: ${details}`);
}

export type ApiEnvironment = z.infer<typeof apiSchema> & z.infer<typeof storageSchema>;
export type WorkerEnvironment = z.infer<typeof workerSchema> & z.infer<typeof storageSchema>;

export function loadApiEnvironment(source: NodeJS.ProcessEnv = process.env): ApiEnvironment {
  return {
    ...parseEnvironment(apiSchema, source),
    ...parseEnvironment(storageSchema, source),
  };
}

export function loadWorkerEnvironment(source: NodeJS.ProcessEnv = process.env): WorkerEnvironment {
  return {
    ...parseEnvironment(workerSchema, source),
    ...parseEnvironment(storageSchema, source),
  };
}

export function loadDatabaseUrl(source: NodeJS.ProcessEnv = process.env): string {
  return parseEnvironment(commonSchema.pick({ DATABASE_URL: true, REDIS_URL: true }), source).DATABASE_URL;
}

export { apiSchema, commonSchema, storageSchema, workerSchema };
