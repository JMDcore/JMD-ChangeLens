import { CheerioCrawler, Configuration, MemoryStorage, PlaywrightCrawler, type CheerioCrawlingContext } from "crawlee";
import type { Page } from "playwright";

import type { ExtractionField, RenderMode, RendererUsed, StructuredOutput } from "@changelens/contracts";

import { ScrapeError } from "./errors.js";
import { assertPublicHttpUrl, guardBrowserRequests, type HostResolver } from "./url-policy.js";
import { coerceExtractedValue } from "./values.js";

export interface ExtractionConfiguration {
  url: string;
  renderMode: RenderMode;
  fields: ExtractionField[];
  userAgent: string;
  timeoutMs: number;
  maxResponseBytes: number;
  maxRedirects: number;
  resolver?: HostResolver;
}

export interface ExtractionResult {
  output: StructuredOutput;
  renderer: RendererUsed;
  finalUrl: string;
  httpStatus: number | null;
  screenshot: Uint8Array | null;
  warnings: string[];
}

interface PageExtraction {
  output: StructuredOutput;
  warnings: string[];
}

function findScrapeError(error: unknown): ScrapeError | null {
  let current = error;
  for (let depth = 0; depth < 6 && current instanceof Error; depth += 1) {
    if (current instanceof ScrapeError) return current;
    current = current.cause;
  }
  return null;
}

function buildValue(values: Array<string | null>, field: ExtractionField, baseUrl: string): StructuredOutput[string] {
  const normalized = values.map((value) => coerceExtractedValue(value, field.valueType, baseUrl));
  return field.multiple ? normalized.filter((value) => value !== null).slice(0, 100) : (normalized[0] ?? null);
}

function addRequiredWarnings(fields: ExtractionField[], output: StructuredOutput, warnings: string[]): void {
  for (const field of fields) {
    const value = output[field.key];
    if (field.required && (value === null || (Array.isArray(value) && value.length === 0))) {
      warnings.push(`Required field '${field.label}' did not match any value.`);
    }
  }
}

export function extractFromCheerio(
  $: NonNullable<CheerioCrawlingContext["$"]>,
  fields: ExtractionField[],
  baseUrl: string,
): PageExtraction {
  const output: StructuredOutput = {};
  const warnings: string[] = [];

  for (const field of fields) {
    try {
      const matches = $(field.selector).slice(0, field.multiple ? 100 : 1);
      const values = matches
        .map((_index, element) => (field.attribute ? ($(element).attr(field.attribute) ?? null) : $(element).text()))
        .get();
      output[field.key] = buildValue(values, field, baseUrl);
      if (field.multiple && $(field.selector).length > 100) {
        warnings.push(`Field '${field.label}' was limited to 100 matches.`);
      }
    } catch (cause) {
      throw new ScrapeError("SELECTOR_INVALID", `Invalid selector for field '${field.label}'`, {
        cause,
        details: { selector: field.selector, field: field.key },
      });
    }
  }

  addRequiredWarnings(fields, output, warnings);
  return { output, warnings };
}

export async function extractFromPage(page: Page, fields: ExtractionField[], baseUrl: string): Promise<PageExtraction> {
  const output: StructuredOutput = {};
  const warnings: string[] = [];

  for (const field of fields) {
    try {
      const locator = page.locator(field.selector);
      const count = Math.min(await locator.count(), field.multiple ? 100 : 1);
      const values: Array<string | null> = [];
      for (let index = 0; index < count; index += 1) {
        const match = locator.nth(index);
        values.push(field.attribute ? await match.getAttribute(field.attribute) : await match.textContent());
      }
      output[field.key] = buildValue(values, field, baseUrl);
      if (field.multiple && (await locator.count()) > 100) {
        warnings.push(`Field '${field.label}' was limited to 100 matches.`);
      }
    } catch (cause) {
      throw new ScrapeError("SELECTOR_INVALID", `Invalid selector for field '${field.label}'`, {
        cause,
        details: { selector: field.selector, field: field.key },
      });
    }
  }

  addRequiredWarnings(fields, output, warnings);
  return { output, warnings };
}

function createCrawleeConfiguration(): { configuration: Configuration; storage: MemoryStorage } {
  const storage = new MemoryStorage({ persistStorage: false });
  const configuration = new Configuration({
    persistStorage: false,
    purgeOnStart: false,
    storageClient: storage,
  });
  return { configuration, storage };
}

async function runStatic(config: ExtractionConfiguration): Promise<Omit<ExtractionResult, "screenshot">> {
  const { configuration, storage } = createCrawleeConfiguration();
  let result: Omit<ExtractionResult, "screenshot"> | undefined;
  let skippedByRobots = false;
  let failedError: Error | undefined;

  const crawler = new CheerioCrawler(
    {
      maxConcurrency: 1,
      maxRequestsPerCrawl: 1,
      maxRequestRetries: 0,
      requestHandlerTimeoutSecs: Math.ceil(config.timeoutMs / 1_000),
      respectRobotsTxtFile: { userAgent: config.userAgent },
      retryOnBlocked: false,
      useSessionPool: false,
      preNavigationHooks: [
        async ({ request }, gotOptions) => {
          await assertPublicHttpUrl(request.url, config.resolver);
          gotOptions.headers = { ...gotOptions.headers, "user-agent": config.userAgent };
          gotOptions.timeout = { request: config.timeoutMs };
          gotOptions.maxRedirects = config.maxRedirects;
          gotOptions.hooks = {
            ...gotOptions.hooks,
            beforeRedirect: [
              ...(gotOptions.hooks?.beforeRedirect ?? []),
              async (options) => {
                if (!options.url) {
                  throw new ScrapeError("REDIRECT_BLOCKED", "A redirect without a destination was blocked", {
                    blocked: true,
                  });
                }
                await assertPublicHttpUrl(options.url, config.resolver);
              },
            ],
          };
        },
      ],
      onSkippedRequest: async () => {
        skippedByRobots = true;
      },
      failedRequestHandler: async (_context, error) => {
        failedError = error;
      },
      requestHandler: async ({ $, request, response }) => {
        const finalUrl = request.loadedUrl ?? request.url;
        await assertPublicHttpUrl(finalUrl, config.resolver);
        const responseBytes =
          typeof response.body === "string"
            ? Buffer.byteLength(response.body)
            : response.body instanceof Uint8Array
              ? response.body.byteLength
              : 0;
        if (responseBytes > config.maxResponseBytes) {
          throw new ScrapeError("RESPONSE_TOO_LARGE", "Response exceeded the configured size limit", {
            details: { bytes: responseBytes, limit: config.maxResponseBytes },
          });
        }
        const extracted = extractFromCheerio($, config.fields, finalUrl);
        result = {
          ...extracted,
          renderer: "cheerio",
          finalUrl,
          httpStatus: response.statusCode ?? null,
        };
      },
    },
    configuration,
  );

  try {
    await crawler.run([{ url: config.url, uniqueKey: `${config.url}#${crypto.randomUUID()}` }]);
  } catch (cause) {
    if (cause instanceof ScrapeError) throw cause;
    const message = cause instanceof Error ? cause.message : "Static extraction failed";
    const code = /timeout/iu.test(message) ? "NAVIGATION_TIMEOUT" : "EXTRACTION_FAILED";
    throw new ScrapeError(code, message, { cause });
  } finally {
    await storage.teardown();
  }

  if (skippedByRobots) {
    throw new ScrapeError("ROBOTS_DISALLOWED", "The target URL is disallowed by robots.txt", {
      blocked: true,
      details: { url: config.url },
    });
  }
  if (failedError) {
    throw (
      findScrapeError(failedError) ??
      new ScrapeError("EXTRACTION_FAILED", failedError.message || "Static extraction failed", { cause: failedError })
    );
  }
  if (!result) throw new ScrapeError("EXTRACTION_FAILED", "Static extraction returned no result");
  return result;
}

async function runBrowser(config: ExtractionConfiguration, options: { extract: boolean }): Promise<ExtractionResult> {
  const { configuration, storage } = createCrawleeConfiguration();
  let result: ExtractionResult | undefined;
  let skippedByRobots = false;
  let failedError: Error | undefined;
  const blockedRequests: Array<{ url: string; error: ScrapeError }> = [];

  const crawler = new PlaywrightCrawler(
    {
      headless: true,
      maxConcurrency: 1,
      maxRequestsPerCrawl: 1,
      maxRequestRetries: 0,
      navigationTimeoutSecs: Math.ceil(config.timeoutMs / 1_000),
      requestHandlerTimeoutSecs: Math.ceil(config.timeoutMs / 1_000) + 10,
      respectRobotsTxtFile: { userAgent: config.userAgent },
      retryOnBlocked: false,
      useSessionPool: false,
      launchContext: {
        launchOptions: {
          chromiumSandbox: true,
        },
      },
      preNavigationHooks: [
        async ({ page, request }, gotoOptions) => {
          await assertPublicHttpUrl(request.url, config.resolver);
          await page.setExtraHTTPHeaders({ "user-agent": config.userAgent });
          await guardBrowserRequests(page, {
            resolver: config.resolver,
            onBlocked: (url, error) => blockedRequests.push({ url, error }),
          });
          page.setDefaultTimeout(config.timeoutMs);
          gotoOptions.timeout = config.timeoutMs;
          gotoOptions.waitUntil = "domcontentloaded";
        },
      ],
      onSkippedRequest: async () => {
        skippedByRobots = true;
      },
      failedRequestHandler: async (_context, error) => {
        failedError = error;
      },
      requestHandler: async ({ page, request, response }) => {
        const finalUrl = request.loadedUrl ?? request.url;
        await assertPublicHttpUrl(finalUrl, config.resolver);

        let redirectCount = 0;
        let redirectedFrom = response?.request().redirectedFrom() ?? null;
        while (redirectedFrom) {
          redirectCount += 1;
          redirectedFrom = redirectedFrom.redirectedFrom();
        }
        if (redirectCount > config.maxRedirects) {
          throw new ScrapeError("REDIRECT_BLOCKED", "Navigation exceeded the configured redirect limit", {
            blocked: true,
            details: { redirects: redirectCount, limit: config.maxRedirects },
          });
        }

        const declaredBytes = Number(response?.headers()["content-length"] ?? 0);
        if (Number.isFinite(declaredBytes) && declaredBytes > config.maxResponseBytes) {
          throw new ScrapeError("RESPONSE_TOO_LARGE", "Response exceeded the configured size limit", {
            details: { bytes: declaredBytes, limit: config.maxResponseBytes },
          });
        }

        const blockedNavigation = blockedRequests.find(({ url }) => url === finalUrl || url === request.url);
        if (blockedNavigation) throw blockedNavigation.error;

        await page
          .waitForLoadState("networkidle", { timeout: Math.min(5_000, config.timeoutMs) })
          .catch(() => undefined);
        const renderedBytes = Buffer.byteLength(await page.content());
        if (renderedBytes > config.maxResponseBytes) {
          throw new ScrapeError("RESPONSE_TOO_LARGE", "Rendered document exceeded the configured size limit", {
            details: { bytes: renderedBytes, limit: config.maxResponseBytes },
          });
        }
        const extracted = options.extract
          ? await extractFromPage(page, config.fields, finalUrl)
          : { output: {}, warnings: [] };

        let screenshot: Uint8Array | null = null;
        try {
          screenshot = await page.screenshot({
            type: "jpeg",
            quality: 82,
            fullPage: false,
            animations: "disabled",
            caret: "hide",
          });
        } catch {
          extracted.warnings.push("The extraction succeeded, but the page screenshot could not be captured.");
        }

        result = {
          ...extracted,
          renderer: "playwright",
          finalUrl,
          httpStatus: response?.status() ?? null,
          screenshot,
        };
      },
      browserPoolOptions: {
        retireBrowserAfterPageCount: 1,
        useFingerprints: false,
      },
    },
    configuration,
  );

  try {
    await crawler.run([
      {
        url: config.url,
        uniqueKey: `${config.url}#${crypto.randomUUID()}`,
      },
    ]);
  } catch (cause) {
    if (cause instanceof ScrapeError) throw cause;
    const message = cause instanceof Error ? cause.message : "Browser extraction failed";
    const code = /timeout/iu.test(message) ? "NAVIGATION_TIMEOUT" : "EXTRACTION_FAILED";
    throw new ScrapeError(code, message, { cause });
  } finally {
    await storage.teardown();
  }

  if (skippedByRobots) {
    throw new ScrapeError("ROBOTS_DISALLOWED", "The target URL is disallowed by robots.txt", {
      blocked: true,
      details: { url: config.url },
    });
  }
  if (failedError) {
    const blocked = blockedRequests[0]?.error;
    throw (
      blocked ??
      findScrapeError(failedError) ??
      new ScrapeError("EXTRACTION_FAILED", failedError.message || "Browser extraction failed", { cause: failedError })
    );
  }
  if (!result) throw new ScrapeError("EXTRACTION_FAILED", "Browser extraction returned no result");
  return result;
}

function hasUsefulData(output: StructuredOutput): boolean {
  return Object.values(output).some((value) => (Array.isArray(value) ? value.length > 0 : value !== null));
}

export async function runExtraction(config: ExtractionConfiguration): Promise<ExtractionResult> {
  const safeUrl = await assertPublicHttpUrl(config.url, config.resolver);
  const normalizedConfig = { ...config, url: safeUrl.toString() };

  if (config.renderMode === "browser") {
    return runBrowser(normalizedConfig, { extract: true });
  }

  if (config.renderMode === "static") {
    const staticResult = await runStatic(normalizedConfig);
    let screenshot: Uint8Array | null = null;
    const warnings = [...staticResult.warnings];
    try {
      screenshot = (await runBrowser(normalizedConfig, { extract: false })).screenshot;
    } catch {
      warnings.push("Static extraction succeeded, but the optional browser screenshot failed.");
    }
    return { ...staticResult, warnings, screenshot };
  }

  try {
    const staticResult = await runStatic(normalizedConfig);
    if (!hasUsefulData(staticResult.output)) {
      return runBrowser(normalizedConfig, { extract: true });
    }

    let screenshot: Uint8Array | null = null;
    const warnings = [...staticResult.warnings];
    try {
      screenshot = (await runBrowser(normalizedConfig, { extract: false })).screenshot;
    } catch {
      warnings.push("Static extraction succeeded, but the optional browser screenshot failed.");
    }
    return { ...staticResult, warnings, screenshot };
  } catch (cause) {
    if (cause instanceof ScrapeError && cause.blocked) throw cause;
    return runBrowser(normalizedConfig, { extract: true });
  }
}
