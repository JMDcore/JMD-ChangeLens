import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import type { Redis } from "ioredis";

export interface DomainLease {
  release: () => Promise<void>;
}

export function computeDomainDelay(lastStartedAt: number | null, now: number, minimumDelayMs: number): number {
  if (lastStartedAt === null) return 0;
  return Math.max(0, lastStartedAt + minimumDelayMs - now);
}

function domainKey(hostname: string): string {
  return createHash("sha256").update(hostname.toLowerCase()).digest("hex").slice(0, 24);
}

export async function acquireDomainLease(
  redis: Redis,
  hostname: string,
  options: { minimumDelayMs: number; leaseTtlMs: number; acquisitionTimeoutMs: number },
): Promise<DomainLease> {
  const namespace = domainKey(hostname);
  const lockKey = `changelens:domain:${namespace}:lock`;
  const lastStartedKey = `changelens:domain:${namespace}:last_started`;
  const token = randomUUID();
  const deadline = Date.now() + options.acquisitionTimeoutMs;

  while (Date.now() < deadline) {
    const acquired = await redis.set(lockKey, token, "PX", options.leaseTtlMs, "NX");
    if (acquired === "OK") {
      const lastStartedRaw = await redis.get(lastStartedKey);
      const waitMs = computeDomainDelay(
        lastStartedRaw ? Number(lastStartedRaw) : null,
        Date.now(),
        options.minimumDelayMs,
      );
      if (waitMs > 0) await delay(waitMs);
      await redis.set(lastStartedKey, String(Date.now()), "PX", 24 * 60 * 60 * 1_000);

      return {
        release: async () => {
          await redis.eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            1,
            lockKey,
            token,
          );
        },
      };
    }

    await delay(200 + Math.floor(Math.random() * 200));
  }

  throw new Error(`Timed out waiting for the per-domain concurrency lease for ${hostname}`);
}
