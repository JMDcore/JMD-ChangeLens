export type ScrapeErrorCode =
  | "URL_INVALID"
  | "URL_SCHEME_BLOCKED"
  | "URL_CREDENTIALS_BLOCKED"
  | "URL_PORT_BLOCKED"
  | "HOSTNAME_BLOCKED"
  | "DNS_RESOLUTION_FAILED"
  | "IP_RANGE_BLOCKED"
  | "REDIRECT_BLOCKED"
  | "ROBOTS_DISALLOWED"
  | "RESPONSE_TOO_LARGE"
  | "SELECTOR_INVALID"
  | "NAVIGATION_TIMEOUT"
  | "EXTRACTION_FAILED";

export class ScrapeError extends Error {
  readonly code: ScrapeErrorCode;
  readonly blocked: boolean;
  readonly details?: Record<string, string | number | boolean | null>;

  constructor(
    code: ScrapeErrorCode,
    message: string,
    options: { blocked?: boolean; cause?: unknown; details?: Record<string, string | number | boolean | null> } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ScrapeError";
    this.code = code;
    this.blocked = options.blocked ?? false;
    this.details = options.details;
  }
}
