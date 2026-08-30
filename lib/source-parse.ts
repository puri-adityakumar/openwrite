// Source parsing at the app boundary.
//
// /paper/new accepts free text — a bare arXiv id, one of the arXiv URL
// forms (/abs/, /pdf/, with or without scheme/version/.pdf/query), a
// local PDF path, or a "fixture:"/"upload:" style reference. The raw
// string used to be passed verbatim to TrueForge as the first user
// message, so a direct PDF link like https://arxiv.org/pdf/2606.19625
// reached the agent un-normalized and failed to parse downstream.
//
// parseSource classifies the input into a small discriminated union:
//   - arxiv → a recognizable arXiv reference, normalized to a bare id
//             (version kept separately) plus canonical abs/pdf URLs
//   - url   → some other http(s) URL — pass through unchanged
//   - path  → a filesystem path (absolute, ~/ , or relative with a
//             file suffix like fixtures/demo.pdf)
//   - raw   → everything else ("fixture:demo", "upload:<id>", prose)
//
// Accepted arXiv forms (host arxiv.org / www.arxiv.org /
// export.arxiv.org, scheme optional, query strings ignored):
//   https://arxiv.org/pdf/2606.19625        ← the case that started this
//   https://arxiv.org/pdf/2606.19625v2
//   https://arxiv.org/pdf/2606.19625.pdf
//   https://arxiv.org/abs/1706.03762
//   http://arxiv.org/abs/1706.03762v3
//   arxiv.org/abs/1706.03762                (no scheme)
//   https://export.arxiv.org/abs/1706.03762
//   1706.03762  ·  1706.03762v2             (bare modern id)
//   cs/0301012  ·  cs.LG/0301012            (bare old-style id)

export type ParsedSource =
  | { kind: "arxiv"; id: string; version: string | null; absUrl: string; pdfUrl: string }
  | { kind: "url"; url: string }
  | { kind: "path"; path: string }
  | { kind: "raw"; raw: string };

// arXiv hosts whose /abs/ and /pdf/ paths we normalize. Any other host
// is passed through untouched.
const ARXIV_HOST_RE = /^(?:www\.|export\.)?arxiv\.org$/;

// Modern ids: YYMM.NNNNN (4- or 5-digit sequence), optional version.
const MODERN_ID_RE = /^(\d{4}\.\d{4,5})(v\d+)?$/;
// Old-style ids: archive/YYMMNNN with an optional subject class
// (cs/0301012, cs.LG/0301012, hep-th/9901001), optional version.
const OLD_STYLE_ID_RE = /^([a-z-]+(?:\.[A-Za-z]{2})?\/\d{7})(v\d+)?$/;

// Split an id-with-version ("1706.03762v2", "cs.LG/0301012v3") into the
// bare id and the "v<n>" suffix. Returns null when the string is not an
// arXiv id at all.
function splitArxivId(candidate: string): { id: string; version: string | null } | null {
  const modern = MODERN_ID_RE.exec(candidate);
  if (modern) return { id: modern[1], version: modern[2] ?? null };
  const old = OLD_STYLE_ID_RE.exec(candidate);
  if (old) return { id: old[1], version: old[2] ?? null };
  return null;
}

// Read the id out of an arXiv /abs/ or /pdf/ pathname. The /pdf/ form
// may carry a ".pdf" suffix (e.g. /pdf/2606.19625.pdf); a trailing
// slash is tolerated. Query and hash never reach here — the URL parser
// strips them into their own fields.
function idFromArxivPath(pathname: string): { id: string; version: string | null } | null {
  const m = /^\/(?:abs|pdf)\/(.+)$/i.exec(pathname.replace(/\/+$/, ""));
  if (!m) return null;
  return splitArxivId(m[1].replace(/\.pdf$/i, ""));
}

// Build the canonical arxiv result. Version-less ids resolve to the
// latest revision; the canonical URLs stay version-free either way so
// every downstream consumer sees the same provenance.
function arxivSource({ id, version }: { id: string; version: string | null }): ParsedSource {
  return {
    kind: "arxiv",
    id,
    version,
    absUrl: `https://arxiv.org/abs/${id}`,
    pdfUrl: `https://arxiv.org/pdf/${id}`,
  };
}

// A filesystem path: absolute, home-relative, Windows drive, or a
// relative path / file suffix like "fixtures/demo.pdf" or "paper.pdf".
// Never matches whitespace-y prose.
function looksLikePath(s: string): boolean {
  if (/\s/.test(s)) return false;
  if (s.startsWith("/") || s.startsWith("./") || s.startsWith("../") || s.startsWith("~")) {
    return true;
  }
  if (/^[A-Za-z]:[\\/]/.test(s)) return true; // Windows drive path
  return /^[\w.-]+(?:\/[\w.-]+)+$/.test(s) || /\.pdf$/i.test(s);
}

export function parseSource(input: string): ParsedSource {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "raw", raw: trimmed };

  // Scheme'd http(s) URL: normalize arXiv hosts, pass the rest through.
  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return { kind: "url", url: trimmed };
    }
    if (ARXIV_HOST_RE.test(url.hostname.toLowerCase())) {
      const parsed = idFromArxivPath(url.pathname);
      if (parsed) return arxivSource(parsed);
    }
    return { kind: "url", url: trimmed };
  }

  // Scheme-less arXiv URL ("arxiv.org/abs/1706.03762"). Re-parse with a
  // scheme so the path handling above applies unchanged.
  if (/^(?:www\.|export\.)?arxiv\.org\//i.test(trimmed)) {
    try {
      const parsed = idFromArxivPath(new URL(`https://${trimmed}`).pathname);
      if (parsed) return arxivSource(parsed);
    } catch {
      // Not parseable as a URL — fall through to the other shapes.
    }
    return { kind: "url", url: trimmed };
  }

  // Bare id, modern or old-style.
  const bare = splitArxivId(trimmed);
  if (bare) return arxivSource(bare);

  // Any other scheme-like prefix ("fixture:", "upload:", "ftp:") is not
  // something we normalize — pass it through unchanged.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return { kind: "raw", raw: trimmed };

  if (looksLikePath(trimmed)) return { kind: "path", path: trimmed };

  return { kind: "raw", raw: trimmed };
}
