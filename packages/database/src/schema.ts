import type { ChangeSet, RenderMode, SchedulePreset, StructuredOutput } from "@changelens/contracts";
import {
  boolean,
  char,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export interface ExecutionInputSnapshot {
  url: string;
  renderMode: RenderMode;
  fields: Array<{
    key: string;
    label: string;
    selector: string;
    valueType: "text" | "number" | "currency" | "date" | "url" | "boolean";
    attribute?: string | null;
    required: boolean;
    multiple: boolean;
  }>;
}

export interface ExecutionLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  context?: Record<string, string | number | boolean | null>;
}

export const monitorStatusEnum = pgEnum("monitor_status", ["healthy", "changed", "failing", "paused", "pending"]);
export const renderModeEnum = pgEnum("render_mode", ["auto", "static", "browser"]);
export const schedulePresetEnum = pgEnum("schedule_preset", ["manual", "every_15m", "hourly", "every_6h", "daily"]);
export const fieldValueTypeEnum = pgEnum("field_value_type", ["text", "number", "currency", "date", "url", "boolean"]);
export const executionStatusEnum = pgEnum("execution_status", ["queued", "running", "succeeded", "failed", "blocked"]);
export const executionTriggerEnum = pgEnum("execution_trigger", ["manual", "scheduled", "preview"]);
export const rendererUsedEnum = pgEnum("renderer_used", ["cheerio", "playwright"]);
export const alertStatusEnum = pgEnum("alert_status", ["queued", "delivered", "failed", "skipped"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 80 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    avatarUrl: text("avatar_url"),
    passwordHash: text("password_hash").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: char("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    userAgent: varchar("user_agent", { length: 300 }),
    ipHash: char("ip_hash", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const monitors = pgTable(
  "monitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    url: text("url").notNull(),
    hostname: varchar("hostname", { length: 253 }).notNull(),
    renderMode: renderModeEnum("render_mode").notNull().default("auto"),
    schedule: schedulePresetEnum("schedule").$type<SchedulePreset>().notNull().default("manual"),
    isActive: boolean("is_active").notNull().default(true),
    status: monitorStatusEnum("status").notNull().default("pending"),
    webhookUrl: text("webhook_url"),
    retentionDays: integer("retention_days").notNull().default(30),
    lastRunAt: timestamp("last_run_at", { withTimezone: true, mode: "date" }),
    lastChangedAt: timestamp("last_changed_at", { withTimezone: true, mode: "date" }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true, mode: "date" }),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("monitors_user_updated_idx").on(table.userId, table.updatedAt),
    index("monitors_user_status_idx").on(table.userId, table.status),
    index("monitors_hostname_idx").on(table.hostname),
  ],
);

export const extractionFields = pgTable(
  "extraction_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    monitorId: uuid("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 64 }).notNull(),
    label: varchar("label", { length: 80 }).notNull(),
    selector: varchar("selector", { length: 500 }).notNull(),
    valueType: fieldValueTypeEnum("value_type").notNull().default("text"),
    attribute: varchar("attribute", { length: 80 }),
    required: boolean("required").notNull().default(false),
    multiple: boolean("multiple").notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("extraction_fields_monitor_key_unique").on(table.monitorId, table.key),
    index("extraction_fields_monitor_position_idx").on(table.monitorId, table.position),
  ],
);

export const executions = pgTable(
  "executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    monitorId: uuid("monitor_id").references(() => monitors.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    trigger: executionTriggerEnum("trigger").notNull(),
    status: executionStatusEnum("status").notNull().default("queued"),
    renderer: rendererUsedEnum("renderer"),
    input: jsonb("input").$type<ExecutionInputSnapshot>(),
    output: jsonb("output").$type<StructuredOutput>(),
    normalizedHash: char("normalized_hash", { length: 64 }),
    screenshotKey: text("screenshot_key"),
    screenshotContentType: varchar("screenshot_content_type", { length: 80 }),
    requestedAt: timestamp("requested_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
    durationMs: integer("duration_ms"),
    attempt: integer("attempt").notNull().default(0),
    httpStatus: integer("http_status"),
    finalUrl: text("final_url"),
    errorCode: varchar("error_code", { length: 80 }),
    errorMessage: text("error_message"),
    blockedReason: text("blocked_reason"),
    warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
    logs: jsonb("logs").$type<ExecutionLogEntry[]>().notNull().default([]),
  },
  (table) => [
    index("executions_monitor_requested_idx").on(table.monitorId, table.requestedAt),
    index("executions_user_requested_idx").on(table.userId, table.requestedAt),
    index("executions_status_idx").on(table.status, table.requestedAt),
  ],
);

export const changes = pgTable(
  "changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    executionId: uuid("execution_id")
      .notNull()
      .references(() => executions.id, { onDelete: "cascade" }),
    previousExecutionId: uuid("previous_execution_id").references(() => executions.id, { onDelete: "set null" }),
    hasChanges: boolean("has_changes").notNull(),
    changeCount: integer("change_count").notNull(),
    summary: jsonb("summary").$type<ChangeSet>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("changes_execution_unique").on(table.executionId),
    index("changes_previous_execution_idx").on(table.previousExecutionId),
  ],
);

export const alertDeliveries = pgTable(
  "alert_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    executionId: uuid("execution_id")
      .notNull()
      .references(() => executions.id, { onDelete: "cascade" }),
    status: alertStatusEnum("status").notNull().default("queued"),
    destinationHost: varchar("destination_host", { length: 253 }).notNull(),
    attempt: integer("attempt").notNull().default(0),
    responseStatus: integer("response_status"),
    errorMessage: text("error_message"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("alert_deliveries_execution_idx").on(table.executionId, table.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 60 }).notNull(),
    entityId: uuid("entity_id"),
    requestId: varchar("request_id", { length: 80 }),
    metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("audit_logs_user_created_idx").on(table.userId, table.createdAt)],
);

export type UserRow = typeof users.$inferSelect;
export type MonitorRow = typeof monitors.$inferSelect;
export type ExecutionRow = typeof executions.$inferSelect;
