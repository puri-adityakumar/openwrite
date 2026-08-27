-- Recap seed — first-paint demo data.
-- Applied by the `recap-db-init` compose service AFTER schema.sql (idempotent).
-- Re-running seed.sql is safe: it uses ON CONFLICT DO NOTHING.
--
-- Demo user credentials: demo@local / demo1234
-- The bcrypt hash below was generated with bcryptjs@3.0.3, cost 10.

-- 1. demo user -----------------------------------------------------------
-- bcryptjs hash of 'demo1234' (cost 10) — verified via bcrypt.compareSync
INSERT INTO users (id, email, password_hash, name)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'demo@local',
    '$2b$10$JpvgSVTw4jZmaVHJ0hPwO.vjN2WtnakI2EPqRCX1ckhW7BfN2I0.S',
    'Demo User'
)
ON CONFLICT (email) DO NOTHING;

-- 2. seeded paper --------------------------------------------------------
-- Slug: attention-is-all-you-need
-- Mode: review (the verb the demo beats use)
-- Status: done (so the cockpit renders the full first paint)
-- source_pdf: a local fixture path, NOT a live arXiv ID — so Replay works offline.
INSERT INTO papers (
    id, user_id, slug, title, source_url, source_pdf, mode, status, session_id, turn_id
)
VALUES (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'attention-is-all-you-need',
    'Attention Is All You Need',
    'https://arxiv.org/abs/1706.03762',
    'fixtures/papers/attention.pdf',
    'review',
    'done',
    'seed-session-0001',
    'seed-turn-0001'
)
ON CONFLICT (slug) DO NOTHING;

-- 3. seed_audits — the events that render the cockpit first paint.
-- The shape MUST match the live `audit` table's event shape (drift guard
-- enforced by `npm run parity`).
INSERT INTO seed_audits (paper_id, events)
VALUES (
    '00000000-0000-0000-0000-000000000010',
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
ON CONFLICT DO NOTHING;
