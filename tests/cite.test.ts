import { describe, it, expect } from "vitest";
import { parseCiteTokens, stripCiteTokens } from "../lib/cite";

// Phase 3.2 — @cite token parser (RED first).
//
// Ask composer accepts free text with `@cite` tokens scoping the question
// to a claim or section. Tokens look like:
//   @cite[claim:abc-123]
//   @cite[section:results]
//   @cite[page:7]
// The parser returns the tokens + the plain text (with tokens stripped)
// so the backend can pass both to the LLM as separate context.

describe("parseCiteTokens", () => {
  it("extracts a single claim token", () => {
    const r = parseCiteTokens("What does @cite[claim:abc-123] say about BLEU?");
    expect(r.cites).toEqual([{ kind: "claim", id: "abc-123" }]);
    expect(r.text).toBe("What does  say about BLEU?");
  });

  it("extracts multiple tokens in order", () => {
    const r = parseCiteTokens("@cite[claim:a] and @cite[page:7]?");
    expect(r.cites).toEqual([
      { kind: "claim", id: "a" },
      { kind: "page", id: "7" },
    ]);
    expect(r.text).toBe(" and ?");
  });

  it("returns empty cites for plain text", () => {
    const r = parseCiteTokens("what is the Transformer?");
    expect(r.cites).toEqual([]);
    expect(r.text).toBe("what is the Transformer?");
  });

  it("ignores malformed tokens (no kind:id shape)", () => {
    const r = parseCiteTokens("try @cite[not-a-token] and @cite[also bad] @cite[ok:1]");
    expect(r.cites).toEqual([{ kind: "ok", id: "1" }]);
  });
});

describe("stripCiteTokens", () => {
  it("removes all @cite[...] tokens from the input", () => {
    expect(stripCiteTokens("a @cite[claim:x] b @cite[page:1] c")).toBe("a  b  c");
  });
  it("leaves plain text alone", () => {
    expect(stripCiteTokens("hello world")).toBe("hello world");
  });
});
