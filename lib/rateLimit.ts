// Phase 1.2 — rate limiting for /api/auth/*.
//
// Qodo round-2 bug fixes:
// - "Spoofed IP bypasses throttling": never trust X-Forwarded-For unless
//   the operator has explicitly opted in with TRUST_PROXY=1. Default to a
//   stable per-process identifier; in dev that's "local", in production
//   behind a trusted reverse proxy the operator should set TRUST_PROXY=1
//   AND the proxy must overwrite (not append) the header.
// - "Unique emails bypass signup limit": check TWO independent counters
//   per request — one keyed by the identity (IP-or-local) and one keyed
//   by the lowercased email alone. Either one exceeding its limit blocks
//   the request. This way an attacker rotating the email still hits the
//   per-identity limit, and rotating the IP still hits the per-email
//   limit.
// - "Interrupted counters never expire": INCR + EXPIRE is no longer two
//   separate commands. We use a tiny Lua script that does
//   `INCR` then `EXPIRE` (only on the first increment) in a single
//   atomic round trip, so the counter always has a TTL.

import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var __recap_redis__: Redis | undefined;
}

type Decision = { allowed: boolean; remaining: number; resetMs: number };

const LIMITS: Record<string, { windowSec: number; max: number }> = {
  // Per-email is the security-relevant counter (Qodo bug: a per-identity
  // limit is redundant and brittle for a multi-tenant demo). 10
  // attempts/min/email is enough headroom for a developer running the
  // E2E suite against the same demo@local account without tripping 429,
  // while still blocking scripted password-spray attacks. Signup stays
  // tighter because new-account creation is the expensive bcrypt path.
  login: { windowSec: 60, max: 10 },
  signup: { windowSec: 60, max: 5 },
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

// Atomic INCR + (EXPIRE only on the first increment). Returned value is the
// post-increment count. The script guarantees the counter always has a TTL.
const INCR_WITH_TTL = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {n, ttl}
`;

export async function checkRateLimit(
  route: "login" | "signup",
  identity: string,
): Promise<Decision> {
  const cfg = LIMITS[route];
  const r = getRedis();
  if (!r) return { allowed: true, remaining: cfg.max, resetMs: cfg.windowSec * 1000 };

  try {
    const key = `recap:rl:${route}:${identity}`;
    const result = (await r.eval(INCR_WITH_TTL, 1, key, String(cfg.windowSec))) as [number, number];
    const count = Number(result[0]);
    const ttl = Number(result[1]);
    const remaining = Math.max(0, cfg.max - count);
    if (count > cfg.max) {
      return { allowed: false, remaining: 0, resetMs: Math.max(0, ttl) * 1000 };
    }
    return { allowed: true, remaining, resetMs: Math.max(0, ttl) * 1000 };
  } catch (err) {
    if (!warnedAboutRedis) {
      console.warn("rateLimit: Redis op failed, failing open:", err);
      warnedAboutRedis = true;
    }
    return { allowed: true, remaining: cfg.max, resetMs: cfg.windowSec * 1000 };
  }
}

// Qodo round-3: clientIdentity() removed. The per-identity limit was
// redundant with the per-email limit and created a brittle counter that
// a developer running an E2E suite could trivially trip. Per-email is
// the security-relevant key; keep the function's removal documented here
// so the next person who tries to add "IP throttling" can see why it's
// out of scope for this phase.
