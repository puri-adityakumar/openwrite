// Phase 3.2 — @cite token parser.
//
// The Ask composer accepts free text with `@cite` tokens that scope a
// question to a specific claim, section, or page. Tokens look like:
//   @cite[claim:<uuid>]
//   @cite[section:<name>]
//   @cite[page:<n>]
//
// Qodo #4 — claim IDs must be UUIDs; the Ask route inserts them into
// a `uuid[]` column and a malformed ID would otherwise produce a
// PostgreSQL cast error (HTTP 500). We validate the UUID shape here
// and silently drop malformed claim tokens (keeping the rest).

export type CiteToken = { kind: string; id: string };
export type ParseResult = { text: string; cites: CiteToken[] };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /@cite\[([a-zA-Z][a-zA-Z0-9_-]*):([^\]]+)\]/g;

function isValidId(kind: string, id: string): boolean {
  if (!id || /\s/.test(id)) return false;
  if (kind === "claim") return UUID_RE.test(id);
  return true; // section / page / future kinds are free-form
}

export function parseCiteTokens(input: string): ParseResult {
  const cites: CiteToken[] = [];
  const text = input.replace(TOKEN_RE, (_match, kind: string, id: string) => {
    if (!isValidId(kind, id)) return _match;
    cites.push({ kind, id: id.trim() });
    return "";
  });
  return { text, cites };
}

export function stripCiteTokens(input: string): string {
  return input.replace(TOKEN_RE, "").trim();
}
