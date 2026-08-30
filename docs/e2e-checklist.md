# E2E Testing Checklist — Recap (OpenWrite)

> Synthesized 2026-08-30 from 6 sub-agent explorations on branch `chore/testing-and-bugfixing`. Single source for manual QA + Playwright automation. Every item cites `path:line`.

**How to use:** Run top-to-bottom. P0 = smoke gate, P1 = regression (including Issue #1), P2 = full surface. Tick `□` → `☑`. Failed item = file issue with ID.

Prerequisites: `npm install && docker compose up` → Postgres 5433, Redis 6380, Next 13000. `npm run parity` = 0, `npm test` = green. Mode default `fake` (no TrueForge). For live gate/SSE checks set `TRUEFORGE_MODE=live` + `npx @truefoundry/trueforge`.

---

## 0. Prerequisites & Test Data

- [ ] **0.1 Seed first paint** — `GET /paper/attention-is-all-you-need` renders without session: Trail 6 pills `done`, Coverage 10 glyphs, Pulse 4 lines (`seed.sql:62-98`, `app/paper/[slug]/page.tsx:48-108`). Audit `GET /paper/attention-is-all-you-need/audit` shows 10 rows (6 pills+4 pulse) footer `Cost —` (`e2e/audit.spec.ts:14`). `GET /api/audit/<seedPaperId>` `source:"seed"`.
- [ ] **0.2 Demo creds visible** — Unauthed `GET /` shows `demo@local / demo1234` plaintext (`components/Landing.tsx:126`, `e2e/stranger.spec.ts:32`). `seed.sql:20-23` bcrypt `$2b$10$...`.
- [ ] **0.3 Parity guard** — `npm run parity` exits 0 (file mode) validates `seed_audits` shape matches `audit` contract (`scripts/parity.ts:33-66`).

---

## 1. Auth & Session — `lib/auth.ts:8`, `lib/session.ts:15`, `app/api/auth/*`

### 1.1 Signup / Login happy paths (P0)
- [ ] **1.1.1 Signup creates user + cookie** — `POST /api/auth/signup {email:"u+${Date.now()}@e.com", password:"valid1234"}` → 200 `user:{id,email}` + `set-cookie recap_session` `httpOnly:true sameSite:lax path:/ maxAge:604800` (`signup/route.ts:85-94`, `e2e/auth.spec.ts:23-42`). Response body must NOT contain `password_hash` nor plaintext password.
- [ ] **1.1.2 Login demo succeeds** — `POST /api/auth/login {email:"demo@local", password:"demo1234"}` → 200 + same cookie flags. `GET /dashboard` shows `signed in as demo@local` (`login/route.ts:82-91`, `auth.spec.ts:45`).
- [ ] **1.1.3 Email normalization** — Signup `MiXeD@Example.COM` then login `mixed@example.com` → 200 (`signup:40-41` trim/lower, `login:46-48`).
- [ ] **1.1.4 Password 8-72 bytes boundary** — `a*8` → 200, `a*72` → 200, `a*73` / `a*80` / `a*7` → 400 `Invalid credentials` (`passwordPolicy.ts:10-11`, `signup:46`, `auth.spec.ts:90`).

### 1.2 Negative & security (P1)
- [ ] **1.2.1 Invalid JSON / missing fields** — `POST /signup` body `"notjson"` → 400 neutral (`signup:34-38`). Missing email or password → 400 (signup) vs login missing/short → 401 (`login:53`). Body must contain `invalid` not `already exists` / field name (no enumeration).
- [ ] **1.2.2 Duplicate signup neutral** — Two `POST /signup` same email sequential → second 400 same message as invalid (`signup:64` + `ON CONFLICT DO NOTHING` line 70). Case-insensitive duplicate `FOO@...` vs `foo@...` same.
- [ ] **1.2.3 Login wrong / non-existent** — `demo@local + definitely-wrong` → 401 not 404, body no `password`/`user not found` (`login:72-80`, `auth.spec.ts:74`). Non-existent `nope-${Date.now()}@... + validPass123` → 401 with fake bcrypt work (`login:75`). Email `DEMO@LOCAL` uppercase login still 200.
- [ ] **1.2.4 Cookie tamper / missing → redirect** — Set `recap_session=not-a-jwt` or slice+`AA`, or `clearCookies` → `GET /dashboard` redirects to `/` (not JSON) → `GET /api/audit/<id>` returns 401 JSON `authentication required` (`session.ts:9-13`, `audit/[id]/route.ts:19`). Variants: pages redirect (307) vs APIs with try/catch 401 — both acceptable, never 200.
- [ ] **1.2.5 JWT flags** — `recap_session` has `httpOnly true`, `sameSite lax`, not accessible via `document.cookie`. Verify decode alg `HS256`, `exp - iat = 604800` (7d) (`auth.ts:33-47`).
- [ ] **1.2.6 Rate limit 429** — Hammer `POST /login` 11× same email in 60s → 11th 429 `Too many requests` + `Retry-After` header. `POST /signup` 6× same email → 6th 429 (`rateLimit.ts:29-38`, `global-setup.ts:24` retry). No Redis → fail-open allowed.

### 1.3 Ownership isolation (P1)
- [ ] **1.3.1 Dashboard isolation** — User A `a-${Date.now()}@e.com` creates paper, User B `GET /api/papers` must NOT see it. `GET /api/papers/[id]/claims` with B’s cookie → 403/404 not 200 (`claims:28`, `stranger.spec.ts` pattern).
- [ ] **1.3.2 Paper page 404 not leak** — B `GET /paper/<A-slug>` → `notFound()` 404, not title (`paper/[slug]/page.tsx:44`). B `POST /api/agent/start {paperId:<A>}` → 404.
- [ ] **1.3.3 Stream isolation** — B `GET /api/agent/stream?paperId=<A>&sessionId=...` → 404/403 (not event leak) (`stream/route.ts:100-108`).

---

## 2. Papers & File Handling — `app/api/papers/route.ts:39`, `app/api/papers/[id]/pdf/route.ts:29`

### 2.1 Create happy paths (P0)
- [ ] **2.1.1 arXiv URL review** — `POST /api/papers {source:"https://arxiv.org/abs/1706.03762", mode:"review"}` → 200 `{paperId, slug}` slug = `arxiv-...-<ts>-<rand>` lowercased, appears in `GET /api/papers` newest-first, dashboard card `title ?? slug` + status pill (`papers/route.ts:67`, `dashboard/page.tsx:74`). Then `POST /api/agent/start {paperId, mode:"review", source}` → 200 `{sessionId, turnId, streamUrl}` status `running` (`start/route.ts:52-64`).
- [ ] **2.1.2 Fixture PDF** — `source:"fixtures/papers/attention.pdf"` → stored as `source_pdf`, `app/paper/[slug]/page.tsx:56` `pdfUrl = /api/papers/<id>/pdf`, `GET /pdf` → 200 `content-type application/pdf cache-control private, max-age=60` (`pdf/route.ts:76`).
- [ ] **2.1.3 Caps** — `capTokens:1` or `capUsd:0.012` at create → `cap_tokens`/`cap_usd` persisted (`papers/route.ts:53-58`). Chip `data-exceeded` logic later.

### 2.2 Validation negatives (P1)
- [ ] **2.2.1 Mode enum** — `mode:"invalid"` / `""` / `"Learn"` (case) / missing → 400 `mode must be learn|deep-read|review` on both `POST /papers` and `/agent/start` (`papers:47`, `start:39`).
- [ ] **2.2.2 Missing source** — `POST /papers {mode:"review"}` → 400 `source, sourceUrl, or sourcePdf is required` (`papers:50`). Client empty input shows inline `Enter a PDF path or arXiv URL.` with no fetch (`NewPaperForm:24`).
- [ ] **2.2.3 Invalid JSON** — body `notjson` → 400 `invalid JSON body` (`papers:44`).
- [ ] **2.2.4 Caps invalid** — `capUsd:0` / `-1` / `"1"` / `NaN` → 400 `capUsd must be a positive number`; `capTokens:0` / `0.5` / `"-5"` → 400 `capTokens must be a positive integer` (`papers:53-58`).
- [ ] **2.2.5 Slug uniqueness** — Parallel `POST /papers` same source rapidly → both 200 distinct slugs (suffix diff), both reachable (`papers:68`).

### 2.3 PDF serving (P1)
- [ ] **2.3.1 Allowlist** — Success `fixtures/papers/attention.pdf` and `data/pdfs/<id>.pdf` → 200. Failures: no `source_pdf` → 404 `no PDF for this paper`; `source_pdf="/etc/passwd"` absolute → 400 `absolute PDF paths are not allowed`; `../../.env` traversal or `schema.sql` → 400 `PDF path outside repo` / `PDF path not in allowlist` (`pdf:64-73`, `ALLOWED_PREFIXES:29`). Foreign owner → 403.
- [ ] **2.3.2 Missing upload endpoint** — `POST /api/files/upload multipart` → 404 (route absent per `docs/architecture.md:96` spec). `NewPaperForm` has no `<input type=file>` — confirm no file input visible (`e2e/stranger:83`).

---

## 3. Agent Lifecycle — `app/api/agent/start:20`, `stream:78`, `halt:47`, `replay:20`, `lib/trueforge.ts:69`

### 3.1 Start & Stream framing (P0)
- [ ] **3.1.1 Start owns paper** — Unauth → 401, wrong user → 404 (`start:31,45`). Double `POST /start` on same paper (no 409) overwrites `session_id/turn_id` still `running` — verify no 409 but UI should disable double-click.
- [ ] **3.1.2 Stream auth & match** — Missing `sessionId/turnId/paperId` → 400. No cookie → 401. Session/turn mismatch → 403 `session/turn does not match paper`. Halted paper `GET /stream` → 409 `run is halted (locked)` (`stream:88-108`).
- [ ] **3.1.3 P7#1 first-byte** — `createTurnStream` throw → 500 `createTurnStream failed`; empty iterator → 204 (`stream:130-143`, `tests/sse-route:74-115`). Success → 200 `content-type text/event-stream; charset=utf-8`, `cache-control no-cache, no-transform`, `x-accel-buffering no`, preamble `retry: 5000` once (`stream:176,404`).
- [ ] **3.1.4 Live smoke** — `POST /start` then `GET /stream` EventSource → first frame `turn.created` → `sandbox.created sbx_…` → `model.message.delta` → `tool.response` → `thread.created` → eventual `turn.done` pending on gate. `data-testid="sandbox-id"` contains `sbx_` (`live-run.spec.ts:31-53`).

### 3.2 Halt 2-state (P1)
- [ ] **3.2.1 Pause from running/queued** — `POST /halt {paperId, action:"pause"}` → 200 `paused` not `halted`, `halt.pause` audit, stream cancelled via `cancelActiveStream` (`halt:60-74`, `stream-registry:25`). Button `data-testid halt-btn data-state pause → Stop` (`halt.spec.ts:31`).
- [ ] **3.2.2 Stop locks** — `POST /halt {action:"stop"}` from `running` or `paused` → 200 `done halted=true halt_reason user`, `halt.stop` audit, TrueForge `cancelSession` POST 200/404 ok (`halt:76-95`). After lock: `GET /stream` 409, `POST /approve` 409, further `halt` 409 (`stream:106`, `approve:133`). UI Pill `data-state locked Stopped` (`halt-button:38`).
- [ ] **3.2.3 Negative halt** — `pause` from `done/paused/error` → 409 `cannot pause a ${status} run` (`halt:61`). Missing `paperId` / invalid `action` → 400. Non-owner → 404. Upstream cancel fail → 502 `TrueForge cancelSession failed` not locked retryable (`halt:82`).
- [ ] **3.2.4 Cap hard-stop** — Create with `capTokens:1`, fake 18402 tokens → `enforceCap` flips `done halted=true halt_reason cap`, emits `cap.exceeded` SSE + audit, chip `data-testid cap-chip data-exceeded true` red (`cap-server:14-43`, `halt.spec.ts:83-122`).

### 3.3 Replay (P1)
- [ ] **3.3.1 Replay while running → 409** — `POST /replay` while `status=running` → 409 `a run is live — halt or wait before replaying` (`replay:28`).
- [ ] **3.3.2 Freshness proof** — From `paused|done|error|halted` → 200 `{sessionId, turnId}` new ids, `status running halted false`, audit `▶ replay started`. `GET /replay?paperId=` before → `originalSandboxId` truthy, after stream second `sandbox.created` → `fresh true`, `replaySandboxId !== originalSandboxId`, audit shows 2× `Verify requested` + both sandbox rows (`replay:96-115`, `e2e/replay:60-77` divides by `uid=session.slice(-6)+turn.slice(-6)`).
- [ ] **3.3.3 Replay supersedes pending gate** — Pending gate before replay → after `UPDATE gates SET status='expired' reason='superseded by replay'`, deny-resume old session best-effort, new run gets fresh `thr_verifier_${uid}` gate not swallowing old key (`replay:36-60`, `tests/replay:190`).

---

## 4. Gates & Approvals — `lib/gates.ts:49`, `app/api/agent/approve:58`, `app/api/agent/stream:220`

### 4.1 REGRESSION — Issue #1 empty thread_id/tool_call_id → 400 (P0 must-pass)
> Root cause: `insertGate` called with `""` from `requiredActions[].toolCalls` missing/nested casing mismatch, then `POST /approve` resumes with empty `thread_id/tool_call_id` → TrueForge 400 `expected string, received undefined` at `input[0].thread_id/tool_call_id`.

- [ ] **4.1.1 Stream skips invalid gate insert (tool.approval_required)** — Fake `NoIdTF` with `payload:{threadId:"thr_noid"}` no `toolCallId` → `buildStream` must NOT insert gate: `SELECT gates WHERE paper_id` = 0, still audit persists. Log `[stream] tool.approval_required without threadId/toolCallId — skipping gate insert` (`stream:235-238`, `tests/sse-route:143-202`).
- [ ] **4.1.2 Stream skips invalid requiredActions** — Live bundle `turn.done requiredActions=[{type:"tool.approval_required", threadId:null, toolCalls:[]}]` → no row, `GET /api/papers/<id>/gates` → `gate:null`, card `gate-empty` (`stream:326-334` guard `if (!threadId||!toolCallId) continue`). Verify log `[stream] requiredAction missing threadId/toolCallId — skipping gate insert`.
- [ ] **4.1.3 Mixed valid/invalid bundle** — `requiredActions=[{type:"tool.approval_required", threadId:"thr1", toolCalls:[{id:"tc1"}]}, {type:"tool.approval_required", threadId:"", toolCalls:[]}]` → exactly 1 gate `thr1/tc1` inserted, no `tool_call_id=''` row.
- [ ] **4.1.4 Casing variants** — `act.tool_calls` vs `toolCalls`, `act.thread_id` vs `threadId`, `first.id` vs `toolCallId` all resolve correctly; `tc_live_1` + `thr_live` gate Approve → 200 not 502 (`stream:321-324` dual fallback).
- [ ] **4.1.5 Approve never 400** — `POST /approve {gateId}` on valid pending gate → 200 `{gate: status allowed/denied, resumedTurnId}`; on invalid (empty ids would have been prevented) would have been 502 `approval failed: TrueForge 400…` — assert NEVER 502 for fake gates. Empty ids path also covers `tool.response_required` (severity reversible) same guard (`stream:320,343`).
- [ ] **4.1.6 Idempotency** — Duplicate `tool.approval_required` same `(threadId,toolCallId)` re-streamed → 1 row `ON CONFLICT DO NOTHING` (`gates:99-104`, `tests/gates:62`).
- [ ] **4.1.7 Fix in current branch** — `app/api/agent/stream/route.ts:228,323` now `if (!threadId||!toolCallId)` before `insertGate` (diff on `chore/testing-and-bugfixing`). Confirm log message includes `threadId=ok|empty toolCallId=ok|empty`.

### 4.2 TTL & expiry (P1)
- [ ] **4.2.1 TTL config** — dev 5m (`APPROVAL_TTL_MS` live 15m, `lib/gates:55`), `__APPROVAL_TTL_MS_FOR_TESTS` hook. `GET /api/agent/gates/<id>` returns `secondsRemaining` (`gates/[id]:57`), `secondsUntilExpiry` `max(0, floor(...))` (`gates:251`).
- [ ] **4.2.2 Expiry flips** — Backdate `UPDATE gates SET expires_at = now() - interval '1 sec'` → `expireOverdueGates` sets `expired decided_at`, `resolveExpiredGates` deny-resumes `user.tool_approval {deny, EXPIRY_COPY:"approval expired — restart verification."}` + paper `turn_id` reattached `running` (`gate-expiry:18-54`). `decideGate` atomic `WHERE status='pending' AND expires_at>now` handles TOCTOU (`gates:180`).
- [ ] **4.2.3 Late decision → 409** — `POST /approve` after TTL → 409 `gate expired at ...` never calls TrueForge (`approve:67-73`, `tests/approve-route:262`).
- [ ] **4.2.4 Concurrent decision race** — Two `POST /approve` same gate parallel → one 200, other 409 `gate already decided` (`gates:195`).
- [ ] **4.2.5 Halted blocks approve** — `halted=true` paper → `POST /approve` 409 `run is halted (locked)` (`approve:133`).

### 4.3 Verify gate G1 spec (P1) — `components/gates/verify-card.tsx:88`, `docs/approval-gates.md:23`
- [ ] **4.3.1 Card chrome** — When `liveState.status=paused`, `VerifyGatePanel` fetches `GET /api/papers/<id>/gates` → renders `verify-card` (`CockpitClient:173,281`). Header `◀ Verify gate · irreversible · expires in M:SS` `verify-header`, `verify-severity`, `verify-countdown /\d+:\d{2}/`, `verify-tool: bash` (`verify-card:176-191`, `gates.spec:70`).
- [ ] **4.3.2 11 items** — All `data-testid g1-*` visible: `provenance, intent, command (pre gate.payload.command||tool_name), budget, envelope, risk-flags, data-scope, persistence, kill-switch, identity, liability` (`verify-card:193-381`, `tests/verify-card:86`).
- [ ] **4.3.3 Allow disabled until owner match** — Input `verify-owner-input`, typed `tensorflow` (from fake `repoOwner` `trueforge:181`) enables Allow (`verify-card:392`). Empty `repoOwner` → forever disabled.
- [ ] **4.3.4 Hold 3s** — Press+hold `verify-allow` 3.2s via `page.mouse` (not boundingBox) → `onAllow` once, `verify-allow-fill` progress. Release before 3s → no call (`verify-card:113-149`, `tests/verify-card:170-191`). Parent re-render mid-hold does NOT reset (`onAllowRef:113`).
- [ ] **4.3.5 Mid-hold expiry cancels** — If `expires_at` hits 0 during hold → `clearInterval` + `setHolding false` no `onAllow` (`verify-card:129`, `tests/verify-card:194`).
- [ ] **4.3.6 Expired copy disabled** — When `status expired` or `seconds===0` → `verify-expired` shows `Approval expired — restart verification.`, all Allow/Deny/Kill/Edit disabled (`verify-card:165-166,441`, `gates:256`, `gates.spec:240`).
- [ ] **4.3.7 Deny** — `verify-deny` prompt `network mode unclear` → 200 `denied` `decided_reason` persisted, no new sandbox (`gates.spec:141-185`, `trueforge:240` deny sequence).

### 4.4 Publish / Save (P2)
- [ ] **4.4.1 Publish** — `publish-card` `irreversible`, `publish-countdown`, `publish-diff` 92.4→91.7 `Δ −0.7` uses `−` U+2212 (`export-md:31`, `publish-card:75,93`), export link `/paper/<slug>/export` (`e2e/gates:99` but not in fake E2E).
- [ ] **4.4.2 Save** — `save-card` `reversible`, `save-count 2 annotations`, rows `save-annotation data-annotation-id`, empty `Nothing to merge.` (`save-card:51,65,79`).
- [ ] **4.4.3 Expiry disables** — Both cards same countdown `expired = status expired || seconds===0` disables Allow/Deny, shows expired copy (`publish:54`, `save:41`).

---

## 5. SSE Pipeline & Live UI — `lib/event-reducer.ts:111`, `app/api/agent/stream:161`, `lib/sse-store.ts:67`, `components/pulse.tsx:19`

### 5.1 Reducer & seq (P1)
- [ ] **5.1.1 Seq guard** — `seq>0 && seq<=cursor` dropped (duplicate/out-of-order), `seq:0|undefined` uncursorable always accepted but cursor not advanced (`event-reducer:115-122`, `tests/event-reducer:179-200`). `wrapWithSeq` assigns monotonic `1..N` if missing (`stream:417`).
- [ ] **5.1.2 Delta coalesce by messageId** — 3 deltas same `m1` → 1 pulse line; different ids → 2 lines (`event-reducer:131-145`, `tests/event-reducer:126-153`).
- [ ] **5.1.3 Coverage upsert** — `tool.response page+ density` `Math.max` on existing, sorted by page; non-number ignored (`event-reducer:150-161`).
- [ ] **5.1.4 Terminal P7#3** — `turn.done requiredActions.length>0` → `status paused terminal paused` emits `turn.paused` not `turn.done`; plain → `done`; `state error` → `error` (`event-reducer:197-218`, `stream:55-60`, `tests/event-reducer:70-102`).

### 5.2 Stream resilience (P1)
- [ ] **5.2.1 Audit persistence** — Every event `appendAudit` before enqueue (`stream:286`). `AuditWriteError` → `event: turn.error {message:"audit write failed"}` and terminal, not silent (`stream:289-293`).
- [ ] **5.2.2 Trail pills** — `TRAIL_ORDER source parse extract score verify done` (`event-reducer:231`). `deriveTrail` inspects pulse strings; while `paused` verify stays `running`, when `done` verify= `done` (Qodo #8 `verifyDone = verifyHit||isDone` `261`). `data-testid trail-pills` 6 `data-pill` `data-state done|running|pending|error` (`live-run:62`).
- [ ] **5.2.3 Halt lock on terminal** — `UPDATE papers SET status=$1 WHERE NOT halted` preserves cap/user stop (`stream:369`). `cancelActiveStream` registry ensures pause tears stream mid-flight (`stream-registry:25`).

### 5.3 Pulse & heartbeat (P1)
- [ ] **5.3.1 Pulse cap 5** — Store max 200 (`event-reducer:63`), UI shows last 5 (`pulse:3`) `data-testid pulse data-line-count`. With `lastHeartbeat` → 4 events +1 hb, without →5 (`pulse:19-23`, `tests/pulse:60-93`). Empty: `Awaiting the first event from the agent.`.
- [ ] **5.3.2 Heartbeat 15s** — Server `: hb` comment every 15s after first event (`stream:183-188`, `HEARTBEAT_MS 15000`). Client `lastHeartbeat` timer every 15s (`CockpitClient:96-105`) + store `onerror emit()` tolerates reconnect without dropping snapshot (`sse-store:97-99`). `retry: 5000` preamble once (`stream:179`).
- [ ] **5.3.3 Coverage glyph** — Grid `data-testid coverage-grid` glyphs `░<0.25 ▒<0.5 ▓<0.75 █` (`CockpitClient:27-32`), seeded 10 pages, live 3 pages contain `░▒▓█` (`live-run:60`).
- [ ] **5.3.4 Cost display GMI rule** — `totalCostInUsd===0 → costDisplay "—"` else `$X.XXX` (`event-reducer:65-69`). Cap chip `Cap: —` baseline vs `N tok` when active, `data-exceeded true` border destructive (`live-run:57`, `halt:110`).

---

## 6. Audit / Claims / Authors / Export / Reader / Ask

### 6.1 Audit timeline (P1)
- [ ] **6.1.1 Seed vs live source** — `buildAuditView` if `session_id!=null` → `audit ORDER BY id ASC` + `rowsFromLiveEvents` else `seed_audits` (`audit-view:31`). Page header `Audit — {title}` (`audit-timeline:20`), `data-testid audit-timeline`, rows `data-testid audit-row data-icon` icon ts message.
- [ ] **6.1.2 Vocabulary** — `▶ session started`, `✓ sandbox created:…`, `✓ mcp initialized`, `✓ subagent: title`, `✓ {tool} ok`, `⏸ Verify requested`, `✓ user allowed` vs `✗ user denied — reason`, `⏸ paused by user`, `⏹ stopped — cap exceeded|by user`, `⏹ cap exceeded (N tokens)`, `▶ replay started`, `✓ fresh sandbox:…`, `⏸ turn paused on N gate(s)` / `✓ turn done` (`audit-rows:24-103`). Unknown types (delta, thread.done) ignored.
- [ ] **6.1.3 Audit footprint** — Seeded: 10 rows + footer `Total tokens — · Cost — · Duration —` (`e2e/audit:18`). Live after deny: `session started` + `Verify requested` + `user denied` + prompt reason `audit e2e deny` in timeline, footer `Total tokens 18,…` + `Cost —` + `Duration \d+`, `GET /api/audit/<id>` mirrors `source live` (`e2e/audit:36-95`).
- [ ] **6.1.4 Actions** — `ReplayButton data-testid replay-btn` + `audit-export-link` href `/paper/<slug>/export` always visible (`audit/page:46-47`). Replay after suite tested in §3.3.

### 6.2 Claims & Authors tabs (P1)
- [ ] **6.2.1 Tabs order** — `Tabs` order Summary | Claims | Authors | Audit (Audit is `<a href="/paper/<slug>/audit">`), `aria-selected`, panels switch (`tabs:14-83`, `e2e/tabs:14-36`). Default `summary-tab` visible with `summary-counts` `{claims} claims · {evidence} evidence` (`summary:3-25`).
- [ ] **6.2.2 Claims** — `GET /api/papers/<id>/claims` → 200 `{claims:[]}` if none, else `ORDER BY created_at ASC` (`claims:32`). Seeded 4 rows (`seed.sql:108` 0.94/0.91/0.97/0.88 confidence pages 1,3,4,8). UI `data-testid claims-tab` table `claim-row data-claim-id`, `confidence-chip` 0-100% or `—` tone `good≥0.9 warn≥0.7 bad` (`claims:5-63`), click → `reader-drawer`. Empty → `No claims extracted yet.`.
- [ ] **6.2.3 Authors** — `GET /api/papers/<id>/authors` distinct `UNNEST(authors)` ORDER BY author (`authors:48-55`), `lookupAuthor` OpenAlex `GET /authors?search=…` (`openalex:36`) with cache. UI states: `Loading authors…` → `No authors listed` → `Authors unavailable: HTTP … role=alert` → cards `data-testid author-card data-author-name`, `author-h-index`, works/citedBy locale (`authors:1-96`). Empty claims → `authors:[]` not crash.
- [ ] **6.2.4 Auth divergence** — Audit/ask/pdf wrap `requireUser` 401 JSON; claims/authors throw redirect (307) when unauth — verify both not 200 (`claims:18`, `audit/[id]:18`).

### 6.3 Reader (P1)
- [ ] **6.3.1 Open/close** — Click `claim-row` → `reader-drawer data-class` visible, `reader-claim` text+evidence, `reader-canvas attached` (blank fixture ok), `reader-close` hides (`e2e/reader-ask:14-27`, `reader:77-103`).
- [ ] **6.3.2 Viewport split** — `drawerClassForViewport(width)` ≥1440 → `reader-split fixed w-2/5` else `reader-replaces` (`reader.ts:10`, `tests/reader:10`).
- [ ] **6.3.3 PDF guards already in §2.3** — Reader fetches via `pdfjs-dist` `getDocument({url:pdfUrl}).promise` scale 1.4 (`reader:49-62`); on error `role=alert PDF error:…` (`reader:100`).

### 6.4 Ask (P1)
- [ ] **6.4.1 Composer** — `data-testid ask-composer/input/submit` (`ask:70-99`). Submit empty or `pending` disabled, `aria-busy` spinner. Helper `Type a question, or @cite[claim:<id>] to pin`.
- [ ] **6.4.2 Auth & validation** — `POST /ask {question}`: 400 `invalid JSON` / `question is required` / `must contain at least one non-cite character` (pure `@cite[claim:…]`) (`ask:42-46`). `parseCiteTokens` UUID strict for `claim` kind, free-form for section/page (`cite:20-24`).
- [ ] **6.4.3 Cite extraction** — `What does @cite[claim:abc-123] say?` non-UUID `abc-123` → `cites[]` text unchanged; valid UUID `@cite[claim:<uuid>]` → stripped from text + `cites:[{kind:claim,id}]`, multi preserves order (`tests/cite:14-36`). Server defence-in-depth filters `UUID_RE` again + `id ANY($2::uuid[])` (`ask:58-67`) prevents Postgres 500.
- [ ] **6.4.4 GMI gate** — `gmiConfigured()` `GMI_API_KEY` present != `replace-me` (`gmi:40`). Missing → 503 `GMI not configured — set GMI_API_KEY in .env` (`ask:48`). Non-ok GMI → 502 `GMI {status}: …` (`gmi:67`, `ask:91`). Success → 200 `{answer,cites,totalTokens}` persists `annotations anchor:{kind:"ask",question,cites,totalTokens}` (`ask:98-103`).
- [ ] **6.4.5 Answer rendering** — Submit `What is the Transformer?` → within 25s either `ask-answer card` visible (GMI configured) or `ask-error role=alert` with 503/502 (tolerant) (`reader-ask:29-41`). Citations in answer regex `\[claim\s+[0-9a-f-]+\]` render `answer-citation data-claim-id` button → `onCite` fetches claims and opens Reader (`ask:43-68`, `CockpitClient:207`).

### 6.5 Export locked behind Publish (P1)
- [ ] **6.5.1 Page** — `GET /paper/<slug>/export` `data-testid export-page` gated `requireUser` (`export/page:26`). `export-page-count Review mode produced {pages} pages.` (`export/page:51`, seeded 10). Sections `export-sections` exactly 4 `li`: `TL;DR`, `Claims ↔ evidence` table `| Claim | Evidence | Page |`, `Reproduction diff`, `Open questions` (`export-md:46-71`, `e2e/export:19`).
- [ ] **6.5.2 Lock** — `exportLocked(gates)` `publish && status!=="allowed"` (`export-md:40`) → `pending/denied/expired` all locked (Qodo round2). Seeded no gates → `export-download btn-primary href download` visible; download click → `review.md` contains `# Attention Is All You Need` + 4 sections (`e2e/export:28-36`). Locked page shows `export-locked Pill tone bad borderColor destructive` `Download locked — allow the Publish gate first` + return link (`export/page:58-71`); `GET /download` → 403 same copy (`download:35-39`). Verify `publish` irrelevant (verify pending does NOT lock).
- [ ] **6.5.3 Delta sign & placeholders** — `reproductionDeltaLine` `Reproduced 91.7% (claimed 92.4%, Δ −0.7)` uses `−` U+2212 not `-` (`export-md:31`, `export-md.test:36`). Missing publish → `— not published yet —`; missing claims/tldr/openQuestions → `_no claims extracted yet_` (`export-md:54`).
- [ ] **6.5.4 Headers** — Unlocked `GET /download` → 200 `content-type text/markdown; charset=utf-8` + `content-disposition attachment; filename="review.md"` (`download:43-46`, `e2e/export:43`).

---

## 7. Env Banner & Tour (P2)
- [ ] **7.1 Banner polling** — `GET /api/env-status` 200 `{mode:live|fake, status:{gmi,daytona}}` no key leak (`env-status:16`). `EnvBannerHost` fetches on mount + 15s + `window.focus` (`env-banner:13-34`). When `mode==="fake"` host renders `null` even if missing (`EnvBannerHost:53`). When live with `DAYTONA_API_KEY` missing → `data-testid env-banner` + `env-banner-sandbox-badge Sandbox preview` + `env-banner-curl` + `env-banner-copy` (`env-banner:46-86`, `banner.spec.ts:14`).
- [ ] **7.2 Tour** — `tour.test.tsx` 7 slides modal pinned.

---

## 8. Execution Order (suggested)

1. **P0 smoke (5 min):** 0.1-0.3 → 1.1.1-1.1.2 → 2.1.1 fixture → 3.1.4 → 5.1.4 → 6.1.1 → 6.2.1-6.2.2 → 6.5.2 unlocked → 1.3.1 quick check.
2. **P1 regression Issue #1 (10 min):** 4.1.1-4.1.7 + 4.2.1-4.2.2 (set `__APPROVAL_TTL_MS_FOR_TESTS=60000` or backdate via `docker exec psql`). Re-run `npm test tests/sse-route.test.ts tests/gates.test.ts tests/approve-route.test.ts`.
3. **P1 halt/cap/replay (10 min):** 3.2 → 3.3 → 5.2.3 → `npx playwright test e2e/halt e2e/replay`.
4. **P1 reader/ask/audit full (10 min):** 6.1-6.5 → `npx playwright test e2e/audit e2e/reader-ask e2e/export e2e/tabs e2e/gates`.
5. **P2 auth negatives & PDF allowlist (10 min):** 1.2 → 2.2-2.3.
6. **P2 SSE edge & isolation:** 5.1-5.3, 1.3.2-1.3.3 tamper session/turn, `e2e/stranger e2e/auth`.

**Automation mapping:** Existing specs cover most P0: `auth.spec.ts:10-100` (guard, signup/login, short pw), `stranger.spec.ts:15-104` (landing → cockpit first paint, mode dial), `live-run.spec.ts:31-66` (full fake run), `cockpit-live.spec.ts:30-51` (mid-run screenshot), `audit.spec.ts:12-96`, `tabs.spec.ts:14-36`, `reader-ask.spec.ts:14-41`, `export.spec.ts:14-47`, `halt.spec.ts:31-122`, `gates.spec.ts:62-250` (TC1-TC3), `banner.spec.ts:14`. New automation needed for §4.1 mixed bundle & §2.3 PDF traversal cases → add `tests/sse-route.test.ts` extension.

---

## 9. Known Gaps to File as Bugs if Failing

- `POST /api/files/upload` missing spec `docs/architecture.md:96` → 404 today (skip in this checklist, note as backlog).
- `POST /api/papers` & `GET /api/papers` unauth returns redirect not 401 JSON (inconsistent with `stream/halt/approve` 401) — normalize to 401 JSON per P7.
- No PDF size/MIME/PDF-magic validation at create (only allowlist at serve).
- No rate limit on `POST /api/papers`.
- `paper.status` not checked on `POST /start` (overwrites halted/running) — should 409.

---

*End — run `git diff --stat` to confirm `app/api/agent/stream/route.ts:228,323` guard landed, then `npm test && npx playwright test --project=chromium --project=judge-ipad`.*
