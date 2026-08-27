// Phase 1.2 — rate limiting for /api/auth/*.
//
// Bugs 2 & 3 (Qodo): unlimited login + signup attempts allow trivial brute
// force and CPU-exhaustion DoS against bcrypt.
//
// Approach: fixed-window counters keyed by (route, identity) where identity is
// the lowercased email for login/signup and the client IP for everything. We
// use the project's Redis (already running in docker-compose). If Redis is
// unavailable we fail open (next-auth libraries are not in scope for this
// phase) but log a single warning so operators can see the degradation.
//
// The store is intentionally small — a single INCR + EXPIRE round trip — so
// each auth attempt adds at most one Redis op before the bcrypt work.

import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var __recap_redis__: Redis | undefined;
}

type Decision = { allowed: boolean; remaining: number; resetMs: number };

const LIMITS: Record<string, { windowSec: number; max: number }> = {
  login: { windowSec: 60, max: 10 },     // 10 login attempts / minute / (ip+email)
  signup: { windowSec: 60, max: 5 },    // 5 signup attempts / minute / (ip+email)
  // NOTE: these are conservative defaults for a local demo. The plan
  // explicitly notes risk "Daytona key missing" — auth is the only public
  // surface in Phase 1, so we keep limits tight.
};

let warnedAboutRedis = false;

function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (globalThis.__recap_redis__) return globalThis.__recap_redis__;
  try {
    const r = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 1 });
    globalThis.__recap_redis__ = r;
    return r;
  } catch (err) {
    if (!warnedAboutRedis) {
      console.warn("rateLimit: Redis unavailable, failing open:", err);
      warnedAboutRedis = true;
    }
    return null;
  }
}

export async function checkRateLimit(
  route: "login" | "signup",
  identity: string,
): Promise<Decision> {
  const cfg = LIMITS[route];
  const r = getRedis();
  if (!r) return { allowed: true, remaining: cfg.max, resetMs: cfg.windowSec * 1000 };

  const key = `recap:rl:${route}:${identity}`;
  try {
    const count = await r.incr(key);
    if (count === 1) {
      await r.expire(key, cfg.windowSec);
    }
    if (count > cfg.max) {
      const ttl = await r.ttl(key);
      return { allowed: false, remaining: 0, resetMs: Math.max(0, ttl) * 1000 };
    }
    return { allowed: true, remaining: cfg.max - count, resetMs: cfg.windowSec * 1000 };
  } catch (err) {
    if (!warnedAboutRedis) {
      console.warn("rateLimit: Redis op failed, failing open:", err);
      warnedAboutRedis = true;
    }
    return { allowed: true, remaining: cfg.max, resetMs: cfg.windowSec * 1000 };
  }
}

export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return "unknown";
}
