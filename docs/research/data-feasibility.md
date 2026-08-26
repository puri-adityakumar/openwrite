# Data Feasibility (live-tested Aug 2026)

- **arXiv metadata:** `export.arxiv.org/api/query?id_list=1706.03762` returns
  Atom XML, no key. ToS: 1 req / 3 s → we use **3.1 s spacing + backoff**.
- **Per-paper download/view counts from arXiv:** **NO public source exists.**
  We do NOT fake it; the stats panel uses citations instead.
- **OpenAlex (free, no key):** title-search → work record with `cited_by_count`
  (Attention Is All You Need: 6,870), `related_works`, topics; author records
  give `h_index`, `works_count`, `cited_by_count`;
  `works_api_url&sort=cited_by_count:desc` → "notable other works."
- **Semantic Scholar Graph API:** correct fields (`citationCount`,
  `influentialCitationCount`) but the keyless pool returned 429s repeatedly →
  use a free API key; OpenAlex stays primary.
- **Full text all resolve:** `/pdf/{id}`, `/html/{id}` (official HTML now live),
  ar5iv, `/e-print/{id}` LaTeX source. ToS: fetch-and-analyze OK, never re-host.

## Pipeline budget: ≤ 6 calls per paper

1. arXiv metadata (Atom)
2. Semantic Scholar (with key)
3. OpenAlex work record
4. OpenAlex author profiles
5. OpenAlex notable other works
6. Full-text links

Fixtures in `/fixtures/papers/` cache one pre-cached PDF + metadata so the
first-paint seed and Replay work fully offline.
