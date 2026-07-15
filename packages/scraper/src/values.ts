import type { FieldValueType, ScalarValue } from "@changelens/contracts";

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

export function parseNumericValue(input: string): number | null {
  let value = normalizeWhitespace(input)
    .replace(/[\u00a0\u202f]/gu, "")
    .replace(/[^0-9,.-]/gu, "");

  if (!value || !/[0-9]/u.test(value)) return null;

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    value = value.replaceAll(thousandsSeparator, "").replace(decimalSeparator, ".");
  } else {
    const separator = lastComma >= 0 ? "," : lastDot >= 0 ? "." : null;
    if (separator) {
      const segments = value.split(separator);
      const fraction = segments.at(-1) ?? "";
      if (segments.length > 2 || fraction.length === 3) {
        value = segments.join("");
      } else {
        value = `${segments.slice(0, -1).join("")}.${fraction}`;
      }
    }
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function coerceExtractedValue(rawValue: string | null, valueType: FieldValueType, baseUrl: string): ScalarValue {
  if (rawValue === null) return null;
  const value = normalizeWhitespace(rawValue);
  if (!value) return null;

  switch (valueType) {
    case "number":
    case "currency":
      return parseNumericValue(value);
    case "boolean": {
      const normalized = value.toLocaleLowerCase("en");
      if (["true", "yes", "available", "in stock", "sí", "si", "1"].includes(normalized)) return true;
      if (["false", "no", "unavailable", "out of stock", "agotado", "0"].includes(normalized)) return false;
      return null;
    }
    case "date": {
      const timestamp = Date.parse(value);
      return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString();
    }
    case "url": {
      try {
        return new URL(value, baseUrl).toString();
      } catch {
        return value;
      }
    }
    case "text":
      return value;
  }
}
