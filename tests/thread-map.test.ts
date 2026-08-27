import { describe, it, expect } from "vitest";
import { ThreadMap, inferRoleFromTitle } from "../lib/thread-map";

// Phase 2.2 — threadId -> role map (P7#5 binding).
//
// P7#5 (architecture): the subagent role prefix in the Pulse line
// ("[reader]", "[verifier]", "[searcher]") MUST come from a map built
// at `create_sub_agent` time — never from parsing event text. This is
// enforced by the reducer using ThreadMap.snapshot() in its `roles` arg;
// the reducer never inspects message text for roles.

describe("inferRoleFromTitle", () => {
  it("returns 'reader' for read/parse titles", () => {
    expect(inferRoleFromTitle("method-section-reader")).toBe("reader");
    expect(inferRoleFromTitle("parse-pdf")).toBe("reader");
  });
  it("returns 'searcher' for related-work titles", () => {
    expect(inferRoleFromTitle("related-works")).toBe("searcher");
    expect(inferRoleFromTitle("cited-papers")).toBe("searcher");
  });
  it("returns 'verifier' for repro titles", () => {
    expect(inferRoleFromTitle("verify-repro")).toBe("verifier");
    expect(inferRoleFromTitle("replication-run")).toBe("verifier");
  });
  it("falls back to 'agent' for unknown titles", () => {
    expect(inferRoleFromTitle("mystery-role")).toBe("agent");
  });
});

describe("ThreadMap", () => {
  it("registers a threadId with an explicit agentInfo.name", () => {
    const m = new ThreadMap();
    const role = m.register("thr_1", { agentInfo: { name: "reader" } });
    expect(role).toBe("reader");
    expect(m.resolve("thr_1")).toBe("reader");
  });

  it("falls back to title inference when agentInfo.name is absent", () => {
    const m = new ThreadMap();
    const role = m.register("thr_1", { title: "claims-extractor" });
    expect(role).toBe("extractor");
    expect(m.resolve("thr_1")).toBe("extractor");
  });

  it("unknown threadIds return undefined", () => {
    const m = new ThreadMap();
    expect(m.resolve("thr_never_seen")).toBeUndefined();
  });

  it("snapshot returns a Map<string,string> the reducer can consume", () => {
    const m = new ThreadMap();
    m.register("thr_1", { agentInfo: { name: "reader" } });
    m.register("thr_2", { title: "verify-repro" });
    const snap = m.snapshot();
    expect(snap.get("thr_1")).toBe("reader");
    expect(snap.get("thr_2")).toBe("verifier");
    expect(snap.size).toBe(2);
    // Snapshot is a fresh Map — mutating the snapshot does not affect the map.
    snap.delete("thr_1");
    expect(m.resolve("thr_1")).toBe("reader");
  });
});
