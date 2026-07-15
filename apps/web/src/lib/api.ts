import type {
  CreateMonitorInput,
  CreatePreviewInput,
  ExecutionSummary,
  MonitorDetail,
  MonitorSummary,
  PublicUser,
} from "@changelens/contracts";

import { demoChange, demoDashboard, demoExecutions, demoMonitorDetails, demoMonitors, demoUser } from "./demo-data";

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_SNAPSHOT === "true";
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

function cookieValue(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method?.toUpperCase() ?? "GET";
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = cookieValue("cl_csrf");
    if (csrf) headers.set("x-changelens-csrf", csrf);
  }

  const response = await fetch(`${apiBase}${path}`, { ...options, headers, credentials: "include", cache: "no-store" });
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const error = body as { error?: { code?: string; message?: string } };
    throw new ApiClientError(
      error.error?.message ?? "The request could not be completed",
      error.error?.code ?? "API_ERROR",
      response.status,
    );
  }
  return body as T;
}

export async function getCurrentUser(): Promise<PublicUser> {
  if (isDemoMode) return demoUser;
  return (await apiRequest<{ user: PublicUser }>("/auth/me")).user;
}

export async function login(email: string, password: string): Promise<PublicUser> {
  if (isDemoMode) return demoUser;
  return (
    await apiRequest<{ user: PublicUser }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })
  ).user;
}

export async function register(name: string, email: string, password: string): Promise<PublicUser> {
  if (isDemoMode) return demoUser;
  return (
    await apiRequest<{ user: PublicUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    })
  ).user;
}

export async function logout(): Promise<void> {
  if (!isDemoMode) await apiRequest<void>("/auth/logout", { method: "POST" });
}

export type DashboardData = typeof demoDashboard;

export async function getDashboard(): Promise<DashboardData> {
  if (isDemoMode) return demoDashboard;
  return apiRequest<DashboardData>("/dashboard");
}

export async function getMonitors(): Promise<MonitorSummary[]> {
  if (isDemoMode) return demoMonitors;
  return (await apiRequest<{ data: MonitorSummary[] }>("/monitors?pageSize=100")).data;
}

export async function getMonitor(id: string): Promise<MonitorDetail> {
  if (isDemoMode) return demoMonitorDetails[id] ?? demoMonitorDetails[demoMonitors[0]!.id]!;
  return (await apiRequest<{ monitor: MonitorDetail }>(`/monitors/${id}`)).monitor;
}

export async function getExecutions(monitorId?: string): Promise<ExecutionSummary[]> {
  if (isDemoMode)
    return monitorId ? demoExecutions.filter((execution) => execution.monitorId === monitorId) : demoExecutions;
  const query = monitorId ? `?pageSize=100&monitorId=${encodeURIComponent(monitorId)}` : "?pageSize=100";
  return (await apiRequest<{ data: ExecutionSummary[] }>(`/executions${query}`)).data;
}

export async function getExecution(id: string) {
  if (isDemoMode) {
    const execution = demoExecutions.find((item) => item.id === id) ?? demoExecutions[0]!;
    return {
      execution,
      change: execution.hasChanges
        ? {
            summary: demoChange,
            previousExecution: {
              id: demoExecutions[3]!.id,
              output: demoExecutions[3]!.output,
              requestedAt: demoExecutions[3]!.requestedAt,
            },
          }
        : null,
      logs:
        execution.status === "failed"
          ? [
              { timestamp: execution.startedAt!, level: "info", message: "Domain policy lease acquired" },
              { timestamp: execution.finishedAt!, level: "error", message: "Navigation timeout reached" },
            ]
          : [
              { timestamp: execution.startedAt!, level: "info", message: "Extraction job started" },
              {
                timestamp: execution.finishedAt!,
                level: "info",
                message: `Extraction completed with ${execution.renderer}`,
              },
            ],
    };
  }
  return apiRequest<{
    execution: ExecutionSummary;
    change: {
      summary: typeof demoChange;
      previousExecution: { id: string; output: unknown; requestedAt: string } | null;
    } | null;
    logs: Array<{ timestamp: string; level: string; message: string }>;
  }>(`/executions/${id}`);
}

export async function createPreview(input: CreatePreviewInput): Promise<string> {
  if (isDemoMode) return demoExecutions[0]!.id;
  return (await apiRequest<{ executionId: string }>("/previews", { method: "POST", body: JSON.stringify(input) }))
    .executionId;
}

export async function createMonitor(input: CreateMonitorInput): Promise<MonitorDetail> {
  if (isDemoMode) return demoMonitorDetails[demoMonitors[0]!.id]!;
  return (await apiRequest<{ monitor: MonitorDetail }>("/monitors", { method: "POST", body: JSON.stringify(input) }))
    .monitor;
}

export async function runMonitor(id: string): Promise<string> {
  if (isDemoMode) return demoExecutions[0]!.id;
  return (await apiRequest<{ executionId: string }>(`/monitors/${id}/run`, { method: "POST" })).executionId;
}
