export type RenderMode = "auto" | "static" | "browser";
export type RendererUsed = "cheerio" | "playwright";
export type SchedulePreset = "manual" | "every_15m" | "hourly" | "every_6h" | "daily";
export type MonitorStatus = "healthy" | "changed" | "failing" | "paused" | "pending";
export type ExecutionStatus = "queued" | "running" | "succeeded" | "failed" | "blocked";
export type ExecutionTrigger = "manual" | "scheduled" | "preview";
export type FieldValueType = "text" | "number" | "currency" | "date" | "url" | "boolean";

export type ScalarValue = string | number | boolean | null;
export type ExtractedValue = ScalarValue | ScalarValue[];
export type StructuredOutput = Record<string, ExtractedValue>;

export interface ExtractionField {
  id?: string;
  key: string;
  label: string;
  selector: string;
  valueType: FieldValueType;
  attribute?: string | null;
  required: boolean;
  multiple: boolean;
  position?: number;
}

export interface MonitorSummary {
  id: string;
  name: string;
  url: string;
  hostname: string;
  renderMode: RenderMode;
  schedule: SchedulePreset;
  isActive: boolean;
  status: MonitorStatus;
  lastRunAt: string | null;
  lastChangedAt: string | null;
  nextRunAt: string | null;
  successRate: number;
  averageDurationMs: number | null;
  fieldCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MonitorDetail extends MonitorSummary {
  fields: ExtractionField[];
  webhookUrl: string | null;
  retentionDays: number;
}

export interface ExecutionSummary {
  id: string;
  monitorId: string | null;
  monitorName?: string | null;
  trigger: ExecutionTrigger;
  status: ExecutionStatus;
  renderer: RendererUsed | null;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  attempt: number;
  httpStatus: number | null;
  finalUrl: string | null;
  output: StructuredOutput | null;
  hasChanges: boolean | null;
  changeCount: number | null;
  screenshotAvailable: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  blockedReason: string | null;
  warnings: string[];
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}
