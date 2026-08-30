import { describe, it, expect } from "vitest";
import { parseSource } from "../lib/source-parse";

// Source parser at the app boundary.
//
// /paper/new accepts free text; parseSource must normalize every common
// arXiv form (bare id, /abs/, /pdf/, with or without scheme, version,
// .pdf suffix, or query string) to a bare id + canonical abs/pdf URLs,
// and pass everything else through unchanged. The exact failing case
// that motivated this module: a user pastes
// https://arxiv.org/pdf/2606.19625 and the raw link used to reach
// TrueForge verbatim, where it failed to parse.

describe("parseSource — arXiv PDF URLs", () => {
  it("parses the exact failing case: a direct /pdf/ link", () => {
    expect(parseSource("https://arxiv.org/pdf/2606.19625")).toEqual({
      kind: "arxiv",
      id: "2606.19625",
      version: null,
      absUrl: "https://arxiv.org/abs/2606.19625",
      pdfUrl: "https://arxiv.org/pdf/2606.19625",
    });
  });

  it("parses a versioned /pdf/ link, keeping the version separately", () => {
    expect(parseSource("https://arxiv.org/pdf/2606.19625v2")).toEqual({
      kind: "arxiv",
      id: "2606.19625",
      version: "v2",
      absUrl: "https://arxiv.org/abs/2606.19625",
      pdfUrl: "https://arxiv.org/pdf/2606.19625",
    });
  });

  it("parses a /pdf/ link with a .pdf suffix", () => {
    expect(parseSource("https://arxiv.org/pdf/2606.19625.pdf")).toMatchObject({
      kind: "arxiv",
      id: "2606.19625",
      version: null,
    });
  });

  it("parses a versioned /pdf/ link with both version and .pdf suffix", () => {
    expect(parseSource("https://arxiv.org/pdf/2606.19625v2.pdf")).toMatchObject({
      kind: "arxiv",
      id: "2606.19625",
      version: "v2",
    });
  });

  it("ignores query strings on /pdf/ links (?format=pdf)", () => {
    expect(parseSource("https://arxiv.org/pdf/2606.19625?format=pdf")).toMatchObject({
      kind: "arxiv",
      id: "2606.19625",
      version: null,
    });
  });
});

describe("parseSource — arXiv abstract URLs", () => {
  it("parses an /abs/ link", () => {
    expect(parseSource("https://arxiv.org/abs/1706.03762")).toEqual({
      kind: "arxiv",
      id: "1706.03762",
      version: null,
      absUrl: "https://arxiv.org/abs/1706.03762",
      pdfUrl: "https://arxiv.org/pdf/1706.03762",
    });
  });

  it("parses an http (not https) versioned /abs/ link", () => {
    expect(parseSource("http://arxiv.org/abs/1706.03762v3")).toMatchObject({
      kind: "arxiv",
      id: "1706.03762",
      version: "v3",
    });
  });

  it("parses a scheme-less arxiv.org link", () => {
    expect(parseSource("arxiv.org/abs/1706.03762")).toMatchObject({
      kind: "arxiv",
      id: "1706.03762",
      version: null,
    });
  });

  it("parses www.arxiv.org links", () => {
    expect(parseSource("https://www.arxiv.org/abs/1706.03762")).toMatchObject({
      kind: "arxiv",
      id: "1706.03762",
    });
  });

  it("parses export.arxiv.org links", () => {
    expect(parseSource("https://export.arxiv.org/abs/1706.03762")).toMatchObject({
      kind: "arxiv",
      id: "1706.03762",
    });
  });

  it("parses an old-style id on an /abs/ path", () => {
    expect(parseSource("https://arxiv.org/abs/cs.LG/0301012")).toMatchObject({
      kind: "arxiv",
      id: "cs.LG/0301012",
      version: null,
    });
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(parseSource("  https://arxiv.org/abs/1706.03762  ")).toMatchObject({
      kind: "arxiv",
      id: "1706.03762",
    });
  });
});

describe("parseSource — bare ids", () => {
  it("parses a bare modern id", () => {
    expect(parseSource("1706.03762")).toEqual({
      kind: "arxiv",
      id: "1706.03762",
      version: null,
      absUrl: "https://arxiv.org/abs/1706.03762",
      pdfUrl: "https://arxiv.org/pdf/1706.03762",
    });
  });

  it("parses a bare modern id with a version", () => {
    expect(parseSource("1706.03762v2")).toMatchObject({
      kind: "arxiv",
      id: "1706.03762",
      version: "v2",
    });
  });

  it("parses a bare old-style archive id", () => {
    expect(parseSource("cs/0301012")).toEqual({
      kind: "arxiv",
      id: "cs/0301012",
      version: null,
      absUrl: "https://arxiv.org/abs/cs/0301012",
      pdfUrl: "https://arxiv.org/pdf/cs/0301012",
    });
  });

  it("parses a bare old-style id with a subject class", () => {
    expect(parseSource("cs.LG/0301012")).toMatchObject({
      kind: "arxiv",
      id: "cs.LG/0301012",
      version: null,
    });
  });

  it("rejects strings that only look like ids", () => {
    // Wrong digit counts / shapes fall through: dot-only strings end up
    // raw, slash-y ones read as relative paths — all pass through
    // unchanged either way.
    expect(parseSource("1706.037")).toMatchObject({ kind: "raw" });
    expect(parseSource("1706.037622")).toMatchObject({ kind: "raw" });
    expect(parseSource("cs/030101")).toMatchObject({ kind: "path" });
  });
});

describe("parseSource — passthrough", () => {
  it("passes fixture: references through as raw", () => {
    expect(parseSource("fixture:demo")).toEqual({ kind: "raw", raw: "fixture:demo" });
  });

  it("passes upload: references through as raw", () => {
    expect(parseSource("upload:abc123")).toEqual({ kind: "raw", raw: "upload:abc123" });
  });

  it("classifies an absolute filesystem path as a path", () => {
    expect(parseSource("/tmp/paper.pdf")).toEqual({ kind: "path", path: "/tmp/paper.pdf" });
  });

  it("classifies a relative fixture path as a path", () => {
    expect(parseSource("fixtures/demo.pdf")).toEqual({ kind: "path", path: "fixtures/demo.pdf" });
  });

  it("passes a non-arXiv https URL through as url, unchanged", () => {
    expect(parseSource("https://example.com/some/paper.pdf?x=1")).toEqual({
      kind: "url",
      url: "https://example.com/some/paper.pdf?x=1",
    });
  });

  it("treats an unrecognizable arXiv path as a plain URL, not a guess", () => {
    expect(parseSource("https://arxiv.org/list/cs/recent")).toEqual({
      kind: "url",
      url: "https://arxiv.org/list/cs/recent",
    });
  });

  it("passes empty and prose input through as raw", () => {
    expect(parseSource("")).toEqual({ kind: "raw", raw: "" });
    expect(parseSource("attention is all you need")).toEqual({
      kind: "raw",
      raw: "attention is all you need",
    });
  });
});
