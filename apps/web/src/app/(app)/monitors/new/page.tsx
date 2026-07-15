"use client";

import {
  ArrowLeft,
  Braces,
  Check,
  ChevronRight,
  Code2,
  Eye,
  Globe2,
  GripVertical,
  LoaderCircle,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { createMonitor, createPreview, getExecution, isDemoMode } from "@/lib/api";
import type {
  CreateMonitorInput,
  ExtractionField,
  RenderMode,
  SchedulePreset,
  StructuredOutput,
} from "@changelens/contracts";

const initialFields: ExtractionField[] = [
  { key: "title", label: "Product title", selector: "h1", valueType: "text", required: true, multiple: false },
  { key: "price", label: "Price", selector: "[data-price]", valueType: "currency", required: true, multiple: false },
  {
    key: "availability",
    label: "Availability",
    selector: "[data-stock]",
    valueType: "text",
    required: false,
    multiple: false,
  },
];

const previewPage = "/demo/lumina-desk-lamp.html";
const fieldKeyPattern = /^[a-z][a-z0-9_]*$/;

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export default function NewMonitorPage() {
  const router = useRouter();
  const [name, setName] = useState("Lumina desk lamp");
  const [url, setUrl] = useState("https://jmdcore.github.io/JMD-ChangeLens/demo/lumina-desk-lamp.html");
  const [renderMode, setRenderMode] = useState<RenderMode>("auto");
  const [schedule, setSchedule] = useState<SchedulePreset>("hourly");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [fields, setFields] = useState<ExtractionField[]>(initialFields);
  const [preview, setPreview] = useState<StructuredOutput | null>({
    title: "Lumina desk lamp",
    price: 109,
    availability: "Only 4 left",
  });
  const [activeField, setActiveField] = useState(1);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validFields = useMemo(() => {
    const keys = fields.map((field) => field.key);
    return (
      fields.every((field) => fieldKeyPattern.test(field.key) && field.label && field.selector) &&
      new Set(keys).size === keys.length
    );
  }, [fields]);

  function updateField(index: number, patch: Partial<ExtractionField>) {
    setFields((current) => current.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)));
  }

  function addField() {
    setFields((current) => [
      ...current,
      {
        key: `field_${current.length + 1}`,
        label: "New field",
        selector: ".selector",
        valueType: "text",
        required: false,
        multiple: false,
      },
    ]);
    setActiveField(fields.length);
  }

  async function runPreview() {
    if (!url || !validFields) return;
    setPreviewing(true);
    setError(null);
    try {
      const executionId = await createPreview({ url, renderMode, fields });
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const detail = await getExecution(executionId);
        if (detail.execution.status === "succeeded") {
          setPreview(detail.execution.output);
          return;
        }
        if (["failed", "blocked"].includes(detail.execution.status))
          throw new Error(detail.execution.errorMessage ?? detail.execution.blockedReason ?? "Preview failed");
        await wait(750);
      }
      throw new Error("Preview is still processing. Check the run explorer for its final state.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not run extraction preview");
    } finally {
      setPreviewing(false);
    }
  }

  async function saveMonitor() {
    setSaving(true);
    setError(null);
    try {
      const input: CreateMonitorInput = {
        name,
        url,
        renderMode,
        schedule,
        isActive: true,
        webhookUrl: webhookUrl || null,
        retentionDays: 30,
        fields,
      };
      const monitor = await createMonitor(input);
      router.push(`/monitors/${monitor.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create monitor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="editor-page">
      <div className="editor-heading">
        <div>
          <Link className="back-link" href="/monitors">
            <ArrowLeft size={13} />
            All monitors
          </Link>
          <h1>Configure extraction</h1>
          <p>Define a public target, map CSS selectors and verify the normalized output.</p>
        </div>
        <div className="page-actions">
          <button className="button button-quiet" onClick={runPreview} disabled={previewing || !validFields}>
            <Eye size={14} />
            {previewing ? "Extracting…" : "Run preview"}
          </button>
          <button
            className="button button-primary"
            onClick={saveMonitor}
            disabled={saving || !name || !url || !validFields}
          >
            <Save size={14} />
            {saving ? "Saving…" : "Create monitor"}
          </button>
        </div>
      </div>
      {error && <div className="error-banner editor-error">{error}</div>}

      <section className="editor-steps" aria-label="Configuration progress">
        <span className="complete">
          <i>
            <Check size={11} />
          </i>
          Target
        </span>
        <ChevronRight size={12} />
        <span className="active">
          <i>2</i>Schema
        </span>
        <ChevronRight size={12} />
        <span>
          <i>3</i>Schedule & alerts
        </span>
      </section>

      <div className="target-strip">
        <label>
          <Globe2 size={14} />
          <input value={url} onChange={(event) => setUrl(event.target.value)} aria-label="Public target URL" />
        </label>
        <label>
          <span>Render</span>
          <select value={renderMode} onChange={(event) => setRenderMode(event.target.value as RenderMode)}>
            <option value="auto">Auto detect</option>
            <option value="static">Static HTML</option>
            <option value="browser">Browser</option>
          </select>
        </label>
        <span className="policy-pass">
          <ShieldCheck size={13} />
          Public network policy
        </span>
      </div>

      <div className="editor-workspace">
        <section className="editor-browser panel">
          <div className="editor-pane-head">
            <div>
              <h2>Page preview</h2>
              <p>Controlled demonstration target</p>
            </div>
            <span className="preview-scale">75%</span>
          </div>
          <div className="browser-frame large">
            <div className="browser-chrome">
              <span />
              <span />
              <span />
              <code>{url}</code>
            </div>
            <iframe src={isDemoMode ? previewPage : previewPage} title="Target preview" sandbox="allow-scripts" />
          </div>
          <div className="selector-overlay selector-title">
            <span>h1</span>
          </div>
          <div className="selector-overlay selector-price active">
            <span>[data-price]</span>
          </div>
          <div className="selector-overlay selector-stock">
            <span>[data-stock]</span>
          </div>
        </section>

        <section className="schema-editor panel">
          <div className="editor-pane-head">
            <div>
              <h2>Extraction schema</h2>
              <p>{fields.length} mapped fields</p>
            </div>
            <button className="icon-button" onClick={addField} aria-label="Add field">
              <Plus size={15} />
            </button>
          </div>
          <div className="field-list">
            {fields.map((field, index) => (
              <div
                className={`field-card ${activeField === index ? "active" : ""}`}
                key={`field-${index}`}
                onClick={() => setActiveField(index)}
              >
                <div className="field-card-head">
                  <GripVertical size={13} />
                  <input
                    value={field.label}
                    onChange={(event) => updateField(index, { label: event.target.value })}
                    aria-label={`Label for field ${index + 1}`}
                  />
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setFields((current) => current.filter((_, fieldIndex) => fieldIndex !== index));
                    }}
                    aria-label={`Remove ${field.label}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="field-controls">
                  <label>
                    <span>Field key</span>
                    <div>
                      <Code2 size={12} />
                      <input
                        value={field.key}
                        onChange={(event) => updateField(index, { key: event.target.value })}
                        aria-label={`Key for field ${index + 1}`}
                        aria-invalid={!fieldKeyPattern.test(field.key)}
                        spellCheck={false}
                      />
                    </div>
                  </label>
                  <label>
                    <span>Type</span>
                    <select
                      value={field.valueType}
                      aria-label={`Type for field ${index + 1}`}
                      onChange={(event) =>
                        updateField(index, { valueType: event.target.value as ExtractionField["valueType"] })
                      }
                    >
                      <option value="text">Text</option>
                      <option value="currency">Currency</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="url">URL</option>
                      <option value="boolean">Boolean</option>
                    </select>
                  </label>
                  <label>
                    <span>CSS selector</span>
                    <div>
                      <Code2 size={12} />
                      <input
                        value={field.selector}
                        onChange={(event) => updateField(index, { selector: event.target.value })}
                        aria-label={`Selector for field ${index + 1}`}
                        spellCheck={false}
                      />
                    </div>
                  </label>
                  <label>
                    <span>Attribute</span>
                    <div>
                      <Code2 size={12} />
                      <input
                        value={field.attribute ?? ""}
                        placeholder="text"
                        onChange={(event) => updateField(index, { attribute: event.target.value || null })}
                        aria-label={`Attribute for field ${index + 1}`}
                        spellCheck={false}
                      />
                    </div>
                  </label>
                </div>
                <div className="field-toggles">
                  <label className="field-toggle">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(event) => updateField(index, { required: event.target.checked })}
                    />
                    <span>Required value</span>
                  </label>
                  <label className="field-toggle">
                    <input
                      type="checkbox"
                      checked={field.multiple}
                      onChange={(event) => updateField(index, { multiple: event.target.checked })}
                    />
                    <span>Multiple values</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button className="add-field-button" onClick={addField}>
            <Plus size={14} />
            Add extraction field
          </button>
        </section>

        <section className="preview-result panel">
          <div className="editor-pane-head">
            <div>
              <h2>Normalized output</h2>
              <p>Typed values from the latest preview</p>
            </div>
            {previewing ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <span className="preview-valid">
                <Check size={11} />
                valid
              </span>
            )}
          </div>
          <div className="json-output">
            <div className="json-brace">{"{"}</div>
            {preview ? (
              Object.entries(preview).map(([key, value], index, entries) => (
                <div className="json-line" key={key}>
                  <span className="json-key">&quot;{key}&quot;</span>
                  <span>: </span>
                  <span className={typeof value === "number" ? "json-number" : "json-string"}>
                    {typeof value === "number" ? value : `"${String(value)}"`}
                  </span>
                  {index < entries.length - 1 && <span>,</span>}
                </div>
              ))
            ) : (
              <div className="json-empty">Run a preview to inspect extracted values.</div>
            )}
            <div className="json-brace">{"}"}</div>
          </div>
          <div className="validation-summary">
            <span>
              <Check size={12} />
              {preview ? Object.keys(preview).length : 0}/{fields.length} fields extracted
            </span>
            <span>
              <WandSparkles size={12} />
              Schema valid
            </span>
          </div>
        </section>
      </div>

      <section className="editor-options panel">
        <label>
          <span>Monitor name</span>
          <input className="form-input" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          <span>Schedule</span>
          <select
            className="form-select"
            value={schedule}
            onChange={(event) => setSchedule(event.target.value as SchedulePreset)}
          >
            <option value="manual">Manual only</option>
            <option value="every_15m">Every 15 minutes</option>
            <option value="hourly">Hourly</option>
            <option value="every_6h">Every 6 hours</option>
            <option value="daily">Daily</option>
          </select>
        </label>
        <label>
          <span>
            Change webhook <small>optional</small>
          </span>
          <input
            className="form-input"
            placeholder="https://hooks.example.com/changelens"
            value={webhookUrl}
            onChange={(event) => setWebhookUrl(event.target.value)}
          />
        </label>
        <div className="option-note">
          <Braces size={14} />
          <span>Webhook events are signed with HMAC-SHA256 and delivered only when structured values change.</span>
        </div>
      </section>
    </div>
  );
}
