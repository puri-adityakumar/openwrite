// Phase 3.2 — @cite token parser.
//
// The Ask composer accepts free text with `@cite` tokens that scope a
// question to a specific claim, section, or page. Tokens look like:
//   @cite[claim:<id>]
//   @cite[section:<name>]
//   @cite[page:<n>]
// Any other kind is still accepted (the downstream LLM is the source of
// truth for what kinds are meaningful), so the parser never silently
// drops a token it didn't recognise.
//
// parseCiteTokens returns both the plain text (with tokens stripped,
// whitespace collapsed) and the resolved tokens. stripCiteTokens is a
// convenience for callers that only need the raw plain text.

export type CiteToken = { kind: string; id: string };
export type ParseResult = { text: string; cites: CiteToken[] };

const TOKEN_RE = /@cite\[([a-zA-Z][a-zA-Z0-9_-]*):([^\]]+)\]/g;

export function parseCiteTokens(input: string): ParseResult {
  const cites: CiteToken[] = [];
  // We do NOT trim the result here — callers that want a normalised
  // string can call .trim() themselves. The token positions are what
  // the LLM cares about; the original sentence structure should be
  // preserved verbatim apart from the removed tokens.
  const text = input.replace(TOKEN_RE, (_match, kind: string, id: string) => {
    if (!id || /\s/.test(id)) return _match;
    cites.push({ kind, id: id.trim() });
    return "";
  });
  return { text, cites };
}

export function stripCiteTokens(input: string): string {
  return input.replace(TOKEN_RE, "").trim();
}
