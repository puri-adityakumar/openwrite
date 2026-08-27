// Phase 3.1 — OpenAlex client.
//
// OpenAlex is a free, open catalog of scholarly works + authors. We
// query it by author name (the seed audit has author names; the live
// run would have them from the parsed paper metadata). No API key
// required; the polite-pool is honoured via a User-Agent header.
//
// We use Node 18+'s native fetch — no new npm deps. The response shape
// is documented at https://docs.openalex.org/.

const OPENALEX_BASE = "https://api.openalex.org";
const UA = "openwrite-recap/0.1 (https://github.com/puri-adityakumar/openwrite)";

export type OpenAlexAuthor = {
  id: string;
  display_name: string;
  works_count: number;
  cited_by_count: number;
  h_index: number | null;
  notable_works: string[]; // titles
  institution: string | null;
};

type OpenAlexAuthorResponse = {
  id: string;
  display_name?: string;
  works_count?: number;
  cited_by_count?: number;
  summary_stats?: { h_index?: number; i10_index?: number };
  notable_works?: Array<{ title?: string; display_name?: string }>;
  last_known_institutions?: Array<{ display_name?: string }>;
};

export async function lookupAuthor(name: string): Promise<OpenAlexAuthor | null> {
  if (!name || name.length < 2) return null;
  const url = `${OPENALEX_BASE}/authors?search=${encodeURIComponent(name)}&per_page=1`;
  try {
    const resp = await fetch(url, { headers: { "User-Agent": UA } });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { results?: OpenAlexAuthorResponse[] };
    const first = data.results?.[0];
    if (!first) return null;
    return {
      id: first.id,
      display_name: first.display_name ?? name,
      works_count: first.works_count ?? 0,
      cited_by_count: first.cited_by_count ?? 0,
      h_index: first.summary_stats?.h_index ?? null,
      notable_works: (first.notable_works ?? [])
        .map((w) => w.title ?? w.display_name ?? "")
        .filter(Boolean)
        .slice(0, 3),
      institution: first.last_known_institutions?.[0]?.display_name ?? null,
    };
  } catch {
    return null;
  }
}
