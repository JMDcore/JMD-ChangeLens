import { z } from "zod";

export const renderModeSchema = z.enum(["auto", "static", "browser"]);
export const schedulePresetSchema = z.enum(["manual", "every_15m", "hourly", "every_6h", "daily"]);
export const fieldValueTypeSchema = z.enum(["text", "number", "currency", "date", "url", "boolean"]);
export const executionStatusSchema = z.enum(["queued", "running", "succeeded", "failed", "blocked"]);
export const executionTriggerSchema = z.enum(["manual", "scheduled", "preview"]);

const optionalPublicUrl = z.preprocess(
  (value) => (value === "" ? null : value),
  z.union([z.string().url().max(2_048), z.null()]).optional(),
);

export const extractionFieldSchema = z.object({
  id: z.string().uuid().optional(),
  key: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, "Use snake_case starting with a letter"),
  label: z.string().trim().min(1).max(80),
  selector: z.string().trim().min(1).max(500),
  valueType: fieldValueTypeSchema.default("text"),
  attribute: z.string().trim().min(1).max(80).nullable().optional(),
  required: z.boolean().default(false),
  multiple: z.boolean().default(false),
  position: z.number().int().min(0).optional(),
});

const monitorCoreSchema = z.object({
  name: z.string().trim().min(2).max(100),
  url: z.string().url().max(2_048),
  renderMode: renderModeSchema.default("auto"),
  schedule: schedulePresetSchema.default("manual"),
  isActive: z.boolean().default(true),
  webhookUrl: optionalPublicUrl,
  retentionDays: z.number().int().min(1).max(365).default(30),
  fields: z.array(extractionFieldSchema).min(1).max(25),
});

export const createMonitorSchema = monitorCoreSchema.superRefine((value, context) => {
  const keys = new Set<string>();
  for (const [index, field] of value.fields.entries()) {
    if (keys.has(field.key)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate field key: ${field.key}`,
        path: ["fields", index, "key"],
      });
    }
    keys.add(field.key);
  }
});

export const updateMonitorSchema = monitorCoreSchema.partial().superRefine((value, context) => {
  if (!value.fields) return;
  const keys = new Set<string>();
  for (const [index, field] of value.fields.entries()) {
    if (keys.has(field.key)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate field key: ${field.key}`,
        path: ["fields", index, "key"],
      });
    }
    keys.add(field.key);
  }
});

export const createPreviewSchema = z.object({
  url: z.string().url().max(2_048),
  renderMode: renderModeSchema.default("auto"),
  fields: z.array(extractionFieldSchema).min(1).max(25),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const executionQuerySchema = paginationSchema.extend({
  status: executionStatusSchema.optional(),
  monitorId: z.string().uuid().optional(),
});

export const monitorQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  active: z.enum(["true", "false"]).optional(),
});

export const idParameterSchema = z.object({ id: z.string().uuid() });

export const scheduleIntervalMs: Record<z.infer<typeof schedulePresetSchema>, number | null> = {
  manual: null,
  every_15m: 15 * 60 * 1_000,
  hourly: 60 * 60 * 1_000,
  every_6h: 6 * 60 * 60 * 1_000,
  daily: 24 * 60 * 60 * 1_000,
};

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;
export type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>;
export type CreatePreviewInput = z.infer<typeof createPreviewSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
