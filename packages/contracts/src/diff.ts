import type { ExtractedValue, StructuredOutput } from "./types.js";

export type ChangeKind = "added" | "removed" | "changed";

export interface FieldChange {
  field: string;
  kind: ChangeKind;
  before?: ExtractedValue;
  after?: ExtractedValue;
}

export interface ChangeSet {
  hasChanges: boolean;
  changeCount: number;
  added: number;
  removed: number;
  changed: number;
  entries: FieldChange[];
}

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(",")}]`;

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`);
  return `{${entries.join(",")}}`;
}

export function buildChangeSet(previous: StructuredOutput | null, current: StructuredOutput): ChangeSet {
  const before = previous ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(current)])].sort();
  const entries: FieldChange[] = [];

  for (const field of keys) {
    const existedBefore = Object.prototype.hasOwnProperty.call(before, field);
    const existsNow = Object.prototype.hasOwnProperty.call(current, field);

    if (!existedBefore && existsNow) {
      entries.push({ field, kind: "added", after: current[field] });
      continue;
    }
    if (existedBefore && !existsNow) {
      entries.push({ field, kind: "removed", before: before[field] });
      continue;
    }
    if (canonicalize(before[field]) !== canonicalize(current[field])) {
      entries.push({ field, kind: "changed", before: before[field], after: current[field] });
    }
  }

  const added = entries.filter((entry) => entry.kind === "added").length;
  const removed = entries.filter((entry) => entry.kind === "removed").length;
  const changed = entries.filter((entry) => entry.kind === "changed").length;

  return {
    hasChanges: entries.length > 0,
    changeCount: entries.length,
    added,
    removed,
    changed,
    entries,
  };
}
