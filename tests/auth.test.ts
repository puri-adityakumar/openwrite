import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, signSession, verifySession } from "../lib/auth";
import { isValidPassword, MIN_PASSWORD_LEN, MAX_PASSWORD_BYTES } from "../lib/passwordPolicy";

// Phase 1.2 — auth unit tests (RED first, then GREEN with the lib/auth impl).
// These cover the pure functions used by /api/auth/signup, /api/auth/login,
// and lib/session.ts. They must not require a live DB or the network.

describe("password hashing", () => {
  it("hashPassword never returns the plaintext", async () => {
    const hash = await hashPassword("hunter2-very-secret");
    expect(hash).not.toContain("hunter2-very-secret");
    expect(hash.length).toBeGreaterThan(20);
  });

  it("hashPassword produces a bcrypt-style hash ($2)", async () => {
    const hash = await hashPassword("demo1234");
    expect(hash).toMatch(/^\$2[aby]?\$\d{2}\$.{53}$/);
  });

  it("verifyPassword accepts the correct password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("verifyPassword rejects a wrong password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("hashPassword is non-deterministic (two hashes differ for same input)", async () => {
    const a = await hashPassword("same-input");
    const b = await hashPassword("same-input");
    expect(a).not.toBe(b);
  });
});

describe("JWT session tokens", () => {
  it("signSession then verifySession round-trips a payload", async () => {
    const token = await signSession({ sub: "user-uuid", email: "demo@local" });
    const payload = await verifySession(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("user-uuid");
    expect(payload?.email).toBe("demo@local");
  });

  it("verifySession rejects a tampered token", async () => {
    const token = await signSession({ sub: "user-uuid" });
    const tampered = token.slice(0, -2) + (token.endsWith("A") ? "BB" : "AA");
    expect(await verifySession(tampered)).toBeNull();
  });

  it("verifySession rejects garbage", async () => {
    expect(await verifySession("not-a-jwt")).toBeNull();
    expect(await verifySession("")).toBeNull();
  });
});

describe("password policy", () => {
  it("accepts a normal password", () => {
    expect(isValidPassword("correct-horse-battery-staple")).toBe(true);
  });

  it("rejects too-short passwords (Qodo: min length)", () => {
    expect(isValidPassword("a".repeat(MIN_PASSWORD_LEN - 1))).toBe(false);
  });

  it("rejects passwords over 72 UTF-8 bytes (Qodo bug 1: bcrypt cap)", () => {
    expect(isValidPassword("a".repeat(MAX_PASSWORD_BYTES + 1))).toBe(false);
  });

  it("accepts a password that is exactly 72 UTF-8 bytes", () => {
    expect(isValidPassword("a".repeat(72))).toBe(true);
  });
});
