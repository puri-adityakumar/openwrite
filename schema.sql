-- Recap schema — single source of truth for the app database.
-- Applied by the `recap-db-init` compose service at first boot (idempotent).
-- This file MUST match the architecture in docs/architecture.md and the
-- event-shape contract enforced by scripts/parity.ts.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. users ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    name          text,
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. papers --------------------------------------------------------------
-- mode: learn | deep-read | review
-- status: queued | running | paused | done | error
CREATE TABLE IF NOT EXISTS papers (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug        text UNIQUE NOT NULL,
    title       text,
    source_url  text,
    source_pdf  text,
    mode        text NOT NULL CHECK (mode IN ('learn', 'deep-read', 'review')),
    status      text NOT NULL CHECK (status IN ('queued', 'running', 'paused', 'done', 'error')),
    session_id  text,
    turn_id     text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz
);

CREATE INDEX IF NOT EXISTS papers_user_id_idx ON papers(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS papers_slug_idx ON papers(slug);

-- 3. audit ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit (
    id          bigserial PRIMARY KEY,
    paper_id    uuid NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    events      jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_paper_id_created_at_idx
    ON audit(paper_id, created_at DESC);

-- 4. annotations ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS annotations (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id    uuid NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    anchor      jsonb NOT NULL,
    body        text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS annotations_paper_id_created_at_idx
    ON annotations(paper_id, created_at DESC);

-- 5. gates ---------------------------------------------------------------
-- kind: verify | publish | save
-- severity: reversible | irreversible
-- status: pending | allowed | denied | expired
CREATE TABLE IF NOT EXISTS gates (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id    uuid NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    kind        text NOT NULL CHECK (kind IN ('verify', 'publish', 'save')),
    severity    text NOT NULL CHECK (severity IN ('reversible', 'irreversible')),
    status      text NOT NULL CHECK (status IN ('pending', 'allowed', 'denied', 'expired')),
    payload     jsonb,
    decided_at  timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gates_paper_id_created_at_idx
    ON gates(paper_id, created_at DESC);

-- 6. seed_audits (first-paint populated demo) -----------------------------
-- The seed_audits table renders the cockpit on first paint. Its event shape
-- MUST match the live `audit` table's event shape — enforced by
-- scripts/parity.ts. See docs/architecture.md "SSE flow" and Phase 1/6.
CREATE TABLE IF NOT EXISTS seed_audits (
    id          bigserial PRIMARY KEY,
    paper_id    uuid NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    events      jsonb NOT NULL
);
