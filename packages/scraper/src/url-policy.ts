import { lookup } from "node:dns/promises";

import ipaddr from "ipaddr.js";
import type { Page } from "playwright";

import { ScrapeError } from "./errors.js";

export interface ResolvedAddress {
  address: string;
  family: number;
}

export type HostResolver = (hostname: string) => Promise<readonly ResolvedAddress[]>;

const blockedHostnames = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "metadata.google.internal.",
  "instance-data",
  "instance-data.ec2.internal",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const blockedIpv4Ranges = new Set([
  "unspecified",
  "broadcast",
  "multicast",
  "linkLocal",
  "loopback",
  "private",
  "reserved",
  "carrierGradeNat",
]);

const blockedIpv6Ranges = new Set([
  "unspecified",
  "linkLocal",
  "multicast",
  "loopback",
  "uniqueLocal",
  "ipv4Mapped",
  "rfc6145",
  "rfc6052",
  "6to4",
  "teredo",
  "reserved",
]);

export function normalizePublicUrl(input: string): URL {
  if (input.length > 2_048) {
    throw new ScrapeError("URL_INVALID", "URL exceeds the 2,048 character limit", { blocked: true });
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch (cause) {
    throw new ScrapeError("URL_INVALID", "URL is not valid", { blocked: true, cause });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ScrapeError("URL_SCHEME_BLOCKED", "Only HTTP and HTTPS URLs are allowed", { blocked: true });
  }
  if (parsed.username || parsed.password) {
    throw new ScrapeError("URL_CREDENTIALS_BLOCKED", "URLs containing credentials are not allowed", { blocked: true });
  }
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    throw new ScrapeError("URL_PORT_BLOCKED", "Only standard HTTP and HTTPS ports are allowed", {
      blocked: true,
      details: { port: Number(parsed.port) },
    });
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (
    blockedHostnames.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new ScrapeError("HOSTNAME_BLOCKED", "Local and metadata hostnames are not allowed", {
      blocked: true,
      details: { hostname },
    });
  }

  parsed.hash = "";
  return parsed;
}

export function isBlockedIpAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return true;
  const parsed = ipaddr.parse(address);

  if (parsed.kind() === "ipv4") {
    return blockedIpv4Ranges.has(parsed.range());
  }

  const ipv6 = parsed as ipaddr.IPv6;
  if (ipv6.isIPv4MappedAddress()) return isBlockedIpAddress(ipv6.toIPv4Address().toString());
  return blockedIpv6Ranges.has(ipv6.range());
}

const defaultResolver: HostResolver = async (hostname) => lookup(hostname, { all: true, verbatim: true });

export async function assertPublicHttpUrl(input: string | URL, resolver: HostResolver = defaultResolver): Promise<URL> {
  const url = normalizePublicUrl(input.toString());
  let addresses: readonly ResolvedAddress[];

  try {
    addresses = await resolver(url.hostname);
  } catch (cause) {
    throw new ScrapeError("DNS_RESOLUTION_FAILED", "The hostname could not be resolved", {
      blocked: true,
      cause,
      details: { hostname: url.hostname },
    });
  }

  if (addresses.length === 0) {
    throw new ScrapeError("DNS_RESOLUTION_FAILED", "The hostname did not resolve to an address", {
      blocked: true,
      details: { hostname: url.hostname },
    });
  }

  const blocked = addresses.find((entry) => isBlockedIpAddress(entry.address));
  if (blocked) {
    throw new ScrapeError("IP_RANGE_BLOCKED", "The hostname resolves to a non-public network", {
      blocked: true,
      details: { hostname: url.hostname, address: blocked.address },
    });
  }

  return url;
}

export async function guardBrowserRequests(
  page: Page,
  options: { resolver?: HostResolver; onBlocked?: (url: string, error: ScrapeError) => void } = {},
): Promise<void> {
  const cache = new Map<string, Promise<URL>>();
  await page.route("**/*", async (route) => {
    const requestUrl = route.request().url();
    const protocol = requestUrl.slice(0, requestUrl.indexOf(":") + 1);

    if (["data:", "blob:", "about:"].includes(protocol)) {
      await route.continue();
      return;
    }

    try {
      const parsed = normalizePublicUrl(requestUrl);
      const key = `${parsed.protocol}//${parsed.hostname}:${parsed.port}`;
      let validation = cache.get(key);
      if (!validation) {
        validation = assertPublicHttpUrl(parsed, options.resolver);
        cache.set(key, validation);
      }
      await validation;
      await route.continue();
    } catch (cause) {
      const error =
        cause instanceof ScrapeError
          ? cause
          : new ScrapeError("REDIRECT_BLOCKED", "A browser request was blocked by the network policy", {
              blocked: true,
              cause,
            });
      options.onBlocked?.(requestUrl, error);
      await route.abort("blockedbyclient");
    }
  });
}
