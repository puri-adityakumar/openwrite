-- Recap seed — first-paint demo data.
-- Applied by the `recap-db-init` compose service AFTER schema.sql (idempotent).
-- Re-running seed.sql is safe under any pre-existing state:
--   * The demo user is inserted only when no user with email='demo@local' exists
--     (avoids the hardcoded UUID clashing with a row already in the DB).
--   * The seeded paper is inserted only when no paper with the canonical slug
--     exists, and the user_id FK is resolved to the existing demo user at
--     insert time.
--   * The seed_audits row is upserted on (paper_id) so reruns refresh the
--     events JSON to the canonical first-paint shape.
--
-- Demo user credentials: demo@local / demo1234
-- The bcrypt hash below was generated with bcryptjs@3.0.3, cost 10.

-- 1. demo user -----------------------------------------------------------
-- bcryptjs hash of 'demo1234' (cost 10) — verified via bcrypt.compareSync
-- The canonical UUID is used by Phase 1.2+ tests as a stable FK target.
INSERT INTO users (id, email, password_hash, name)
SELECT
    '00000000-0000-0000-0000-000000000001',
    'demo@local',
    '$2b$10$JpvgSVTw4jZmaVHJ0hPwO.vjN2WtnakI2EPqRCX1ckhW7BfN2I0.S',
    'Demo User'
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'demo@local'
);

-- 2. seeded paper --------------------------------------------------------
-- Slug: attention-is-all-you-need
-- Mode: review (the verb the demo beats use)
-- Status: done (so the cockpit renders the full first paint)
-- source_pdf: a local fixture path, NOT a live arXiv ID — so Replay works offline.
-- The user_id is resolved to the demo user's actual id (canonical or natural-key
-- match) so the FK is always satisfied even if step 1 was a no-op.
INSERT INTO papers (
    id, user_id, slug, title, source_url, source_pdf, mode, status, session_id, turn_id
)
SELECT
    '00000000-0000-0000-0000-000000000010',
    (SELECT id FROM users WHERE email = 'demo@local'),
    'attention-is-all-you-need',
    'Attention Is All You Need',
    'https://arxiv.org/abs/1706.03762',
    'fixtures/papers/attention.pdf',
    'review',
    'done',
    NULL,
    NULL
WHERE NOT EXISTS (
    SELECT 1 FROM papers WHERE slug = 'attention-is-all-you-need'
);

-- 3. seed_audits — the events that render the cockpit first paint.
-- The shape MUST match the live `audit` table's event shape (drift guard
-- enforced by `npm run parity`).
-- Upsert on (paper_id): on a fresh DB the row is inserted; on a rerun the
-- events JSON is refreshed to the canonical first-paint shape, so an old or
-- partial seed row never lingers.
INSERT INTO seed_audits (paper_id, events)
VALUES (
    (SELECT id FROM papers WHERE slug = 'attention-is-all-you-need'),
    '{
        "trail": {
            "pills": [
                { "id": "source",  "label": "Source",  "state": "done" },
                { "id": "parse",   "label": "Parse",   "state": "done" },
                { "id": "extract", "label": "Extract", "state": "done" },
                { "id": "score",   "label": "Score",   "state": "done" },
                { "id": "verify",  "label": "Verify",  "state": "done" },
                { "id": "done",    "label": "Done",    "state": "done" }
            ]
        },
        "coverage": {
            "pages": [
                { "page": 1, "density": 0.85 },
                { "page": 2, "density": 0.72 },
                { "page": 3, "density": 0.91 },
                { "page": 4, "density": 0.60 },
                { "page": 5, "density": 0.78 },
                { "page": 6, "density": 0.55 },
                { "page": 7, "density": 0.83 },
                { "page": 8, "density": 0.69 },
                { "page": 9, "density": 0.74 },
                { "page": 10, "density": 0.88 }
            ]
        },
        "summary": {
            "title": "Attention Is All You Need",
            "abstract": "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
            "tldr": "Replace RNN/CNN sequence models with a pure attention mechanism (self-attention + multi-head), enabling parallel training and better long-range modeling.",
            "claims_count": 4,
            "evidence_count": 11
        },
        "pulse": [
            "8 authors · 11 figures · 4 tables",
            "Trained on WMT 2014 EN-DE and EN-FR translation tasks",
            "Outperforms prior SOTA on both BLEU and training cost",
            "Introduces multi-head scaled dot-product attention",
            "Foundation for nearly every modern LLM (GPT, BERT, T5, …)"
        ]
    }'::jsonb
)
ON CONFLICT (paper_id) DO UPDATE SET events = EXCLUDED.events;
