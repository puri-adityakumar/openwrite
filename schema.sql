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
--
-- Phase 4.1 added: thread_id + tool_call_id (unique key per the
-- approval-gates spec), tool_name (Pulse line), expires_at (TTL
-- countdown), decided_reason (Deny copy). (threadId, toolCallId) is
-- the natural identity of an approval so a duplicate upstream event
-- doesn't double-insert.
CREATE TABLE IF NOT EXISTS gates (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id        uuid NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    kind            text NOT NULL CHECK (kind IN ('verify', 'publish', 'save')),
    severity        text NOT NULL CHECK (severity IN ('reversible', 'irreversible')),
    status          text NOT NULL CHECK (status IN ('pending', 'allowed', 'denied', 'expired')),
    thread_id       text NOT NULL,
    tool_call_id    text NOT NULL,
    tool_name       text NOT NULL,
    payload         jsonb,
    expires_at      timestamptz NOT NULL,
    decided_at      timestamptz,
    decided_reason  text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (thread_id, tool_call_id)
);

-- Forward-compat ALTERs for an existing Phase 0/3 gates table that
-- pre-dates the Phase 4.1 columns. These are no-ops on a fresh DB
-- (CREATE TABLE above already has them).
ALTER TABLE gates ADD COLUMN IF NOT EXISTS thread_id       text;
ALTER TABLE gates ADD COLUMN IF NOT EXISTS tool_call_id    text;
ALTER TABLE gates ADD COLUMN IF NOT EXISTS tool_name       text;
ALTER TABLE gates ADD COLUMN IF NOT EXISTS expires_at      timestamptz;
ALTER TABLE gates ADD COLUMN IF NOT EXISTS decided_reason  text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_name = 'gates' AND constraint_name = 'gates_thread_id_tool_call_id_key') THEN
    -- Backfill thread_id/tool_call_id for any legacy rows that pre-date
    -- Phase 4.1 (Phase 0 scaffold left no rows; this is a defensive
    -- backstop in case a partial Phase 4 migration ran before the
    -- columns were added).
    UPDATE gates
       SET thread_id    = COALESCE(thread_id, 'legacy:' || id::text),
           tool_call_id = COALESCE(tool_call_id, 'legacy:' || id::text),
           tool_name    = COALESCE(tool_name, 'legacy'),
           expires_at   = COALESCE(expires_at, created_at + interval '5 minutes')
     WHERE thread_id IS NULL OR tool_call_id IS NULL OR tool_name IS NULL OR expires_at IS NULL;
    ALTER TABLE gates ALTER COLUMN thread_id    SET NOT NULL;
    ALTER TABLE gates ALTER COLUMN tool_call_id SET NOT NULL;
    ALTER TABLE gates ALTER COLUMN tool_name    SET NOT NULL;
    ALTER TABLE gates ALTER COLUMN expires_at   SET NOT NULL;
    ALTER TABLE gates ADD CONSTRAINT gates_thread_id_tool_call_id_key UNIQUE (thread_id, tool_call_id);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS gates_paper_id_created_at_idx
    ON gates(paper_id, created_at DESC);

CREATE INDEX IF NOT EXISTS gates_status_expires_at_idx
    ON gates(status, expires_at) WHERE status = 'pending';

-- 5b. claims (Phase 3) -------------------------------------------------
-- Per-claim rows: text, evidence quote, confidence, anchor (page),
-- authors. The Claims tab renders from this; Reader opens at anchor.
CREATE TABLE IF NOT EXISTS claims (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id      uuid NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    text          text NOT NULL,
    evidence      text,
    confidence    real,
    page          integer,
    authors       text[],
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS claims_paper_id_created_at_idx
    ON claims(paper_id, created_at DESC);

-- 6. seed_audits (first-paint populated demo) -----------------------------
-- The seed_audits table renders the cockpit on first paint. Its event shape
-- MUST match the live `audit` table's event shape — enforced by
-- scripts/parity.ts. See docs/architecture.md "SSE flow" and Phase 1/6.
-- One row per paper (the demo paper), so the seed INSERT can target
-- (paper_id) with ON CONFLICT for idempotency.
CREATE TABLE IF NOT EXISTS seed_audits (
    id          bigserial PRIMARY KEY,
    paper_id    uuid NOT NULL UNIQUE REFERENCES papers(id) ON DELETE CASCADE,
    events      jsonb NOT NULL
);

-- Idempotent migration: ensure the UNIQUE constraint on seed_audits.paper_id
-- exists even if the table was created by an earlier schema without it.
-- (CREATE TABLE IF NOT EXISTS is a no-op when the table already exists, so
-- the UNIQUE clause above does not apply to existing tables.)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'seed_audits_paper_id_key'
          AND conrelid = 'public.seed_audits'::regclass
    ) THEN
        ALTER TABLE seed_audits ADD CONSTRAINT seed_audits_paper_id_key UNIQUE (paper_id);
    END IF;
END
$$;
