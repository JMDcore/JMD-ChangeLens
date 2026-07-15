"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock3,
  Code2,
  Download,
  ExternalLink,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ExecutionTable } from "@/components/execution-table";
import { StatusPill } from "@/components/status-pill";
import { formatDuration, formatRelativeTime } from "@/components/time";
import { getExecution, getExecutions, getMonitor, isDemoMode, runMonitor } from "@/lib/api";
import type { ChangeSet, ExecutionSummary, MonitorDetail } from "@changelens/contracts";

type ExecutionDetail = Awaited<ReturnType<typeof getExecution>>;

export default function MonitorDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [monitor, setMonitor] = useState<MonitorDetail | null>(null);
  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [selected, setSelected] = useState<ExecutionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextMonitor, nextExecutions] = await Promise.all([getMonitor(id), getExecutions(id)]);
      setMonitor(nextMonitor);
      setExecutions(nextExecutions);
      if (nextExecutions[0]) setSelected(await getExecution(nextExecutions[0].id));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load monitor");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const latestOutput = selected?.execution.output ?? null;
  const change = selected?.change?.summary as ChangeSet | undefined;
  const previewUrl = isDemoMode ? "/demo/lumina-desk-lamp.html" : monitor?.url;
  const exportBase = `/api/executions/${selected?.execution.id ?? ""}/export`;

  async function startRun() {
    setRunning(true);
    try {
      await runMonitor(id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not queue this run");
    } finally {
      setRunning(false);
    }
  }

  if (loading && !monitor)
    return (
      <div className="detail-loading">
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  if (error && !monitor) return <div className="error-banner">{error}</div>;
  if (!monitor) return null;

  return (
    <>
      <div className="detail-heading">
        <Link className="back-link" href="/monitors">
          <ArrowLeft size={13} />
          All monitors
        </Link>
        <div className="detail-title-row">
          <div>
            <div className="title-with-status">
              <h1>{monitor.name}</h1>
              <StatusPill status={monitor.status} />
            </div>
            <a href={monitor.url} target="_blank" rel="noreferrer">
              {monitor.hostname}
              <ExternalLink size={11} />
            </a>
          </div>
          <div className="page-actions">
            <button className="button button-quiet" onClick={load}>
              <RefreshCw size={14} />
              Refresh
            </button>
            <button className="button button-primary" disabled={running} onClick={startRun}>
              <Play size={14} fill="currentColor" />
              {running ? "Queuing…" : "Run now"}
            </button>
          </div>
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <section className="monitor-facts" aria-label="Monitor configuration">
        <div>
          <small>Schedule</small>
          <strong>
            <Clock3 size={13} />
            {monitor.schedule.replaceAll("_", " ")}
          </strong>
          <span>next {formatRelativeTime(monitor.nextRunAt)}</span>
        </div>
        <div>
          <small>Renderer</small>
          <strong>
            <Code2 size={13} />
            {monitor.renderMode}
          </strong>
          <span>
            {monitor.averageDurationMs ? `${formatDuration(monitor.averageDurationMs)} average` : "no samples"}
          </span>
        </div>
        <div>
          <small>Extraction schema</small>
          <strong>{monitor.fieldCount} fields</strong>
          <span>{monitor.fields.filter((field) => field.required).length} required</span>
        </div>
        <div>
          <small>Policy</small>
          <strong>
            <ShieldCheck size={13} />
            Public targets only
          </strong>
          <span>{monitor.retentionDays} day retention</span>
        </div>
      </section>

      <div className="inspection-grid">
        <section className="panel capture-panel">
          <div className="panel-header">
            <div>
              <h2>Captured page</h2>
              <p>Viewport from latest successful execution</p>
            </div>
            <span className="capture-meta">
              <Camera size={12} />
              1440 × 900
            </span>
          </div>
          <div className="browser-frame">
            <div className="browser-chrome">
              <span />
              <span />
              <span />
              <code>{monitor.url}</code>
            </div>
            <iframe src={previewUrl} title={`Captured page for ${monitor.name}`} sandbox="allow-scripts" />
          </div>
        </section>

        <section className="panel result-panel">
          <div className="panel-header">
            <div>
              <h2>Structured result</h2>
              <p>Latest normalized field values</p>
            </div>
            <div className="export-actions">
              <a href={`${exportBase}?format=json`} download>
                <Download size={12} />
                JSON
              </a>
              <a href={`${exportBase}?format=csv`} download>
                <Download size={12} />
                CSV
              </a>
            </div>
          </div>
          <div className="structured-result">
            {latestOutput ? (
              Object.entries(latestOutput).map(([key, value]) => (
                <div key={key}>
                  <span>{key}</span>
                  <code>{String(value)}</code>
                </div>
              ))
            ) : (
              <div className="empty-state">No structured output is available.</div>
            )}
          </div>
          <div className="schema-foot">
            {monitor.fields.map((field) => (
              <span key={field.key}>
                <code>{field.selector}</code>
                <small>{field.valueType}</small>
              </span>
            ))}
          </div>
        </section>
      </div>

      <div className="monitor-lower-grid">
        <section className="panel diff-panel">
          <div className="panel-header">
            <div>
              <h2>Change comparison</h2>
              <p>{change?.hasChanges ? `${change.changeCount} field changes detected` : "No changes in this run"}</p>
            </div>
            {change?.hasChanges ? (
              <span className="change-badge">review</span>
            ) : (
              <CheckCircle2 className="success-icon" size={17} />
            )}
          </div>
          {change?.entries?.length ? (
            <div className="diff-list">
              {change.entries.map((entry) => (
                <div key={entry.field}>
                  <span className="diff-field">{entry.field}</span>
                  <div className="diff-values">
                    <code className="before">− {String(entry.before ?? "∅")}</code>
                    <code className="after">+ {String(entry.after ?? "∅")}</code>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-change">
              <CheckCircle2 size={24} />
              <strong>Output is stable</strong>
              <span>The extracted values match the previous successful run.</span>
            </div>
          )}
        </section>

        <section className="panel run-log-panel">
          <div className="panel-header">
            <div>
              <h2>Run log</h2>
              <p>Policy and processing decisions</p>
            </div>
            {selected?.execution.status === "failed" && <AlertTriangle size={16} className="warning-icon" />}
          </div>
          <div className="log-lines">
            {selected?.logs.map((line, index) => (
              <div key={`${line.timestamp}-${index}`}>
                <time>{new Date(line.timestamp).toLocaleTimeString([], { hour12: false })}</time>
                <span className={`log-${line.level}`}>{line.level}</span>
                <code>{line.message}</code>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel history-panel">
        <div className="panel-header">
          <div>
            <h2>Execution timeline</h2>
            <p>Select a run to inspect its output</p>
          </div>
          <span className="result-count">{executions.length} records</span>
        </div>
        <ExecutionTable executions={executions} showMonitor={false} />
      </section>
    </>
  );
}
