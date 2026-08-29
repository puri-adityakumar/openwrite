#!/usr/bin/env bash
# End-to-end smoke against real TrueForge + GMI.
# Usage:  bash scripts/smoke.sh [TF_BASE_URL]
# Requires: TrueForge running, app running on $APP_PORT (default 13000),
# demo user seeded in DB (demo@openwrite.dev / demo1234).
#
# This script:
#   1. logs in as demo
#   2. creates a paper
#   3. POSTs /api/agent/start  -> sessionId + turnId
#   4. opens SSE stream, captures events until terminal
#   5. (if gate appears) POSTs /api/agent/approve decision=allow
#   6. reports event types seen + last 5 SSE lines
set -u

APP="${APP_PORT:-13000}"
HOST="http://localhost:$APP"
EMAIL="demo@local"
PASS="demo1234"
JAR_A="$(mktemp)"
JAR_B="$(mktemp)"
trap 'rm -f "$JAR_A" "$JAR_B"' EXIT

say() { echo "[smoke] $*"; }
die() { say "FAIL: $*"; exit 1; }

# 1. login
say "login as $EMAIL"
curl -sS -c "$JAR_A" -X POST "$HOST/api/auth/login" \
  -H "content-type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" >/dev/null \
  -w "  http=%{http_code}\n" || die "login failed"

# 2. create paper
PAPER=$(curl -sS -b "$JAR_A" -X POST "$HOST/api/papers" \
  -H "content-type: application/json" \
  -d '{"title":"Smoke test","slug":"smoke-'$RANDOM'","source":"https://arxiv.org/abs/1706.03762","mode":"review"}' \
  | tee /tmp/paper-resp.json)
PAPER_ID=$(echo "$PAPER" | python3 -c "import sys,json;print(json.load(sys.stdin).get('paperId','') or json.load(sys.stdin).get('paper',{}).get('id','') or json.load(sys.stdin).get('id',''))" 2>/dev/null)
[ -n "$PAPER_ID" ] || PAPER_ID=$(echo "$PAPER" | python3 -c "import sys,json;print(json.load(sys.stdin).get('paperId',''))")
[ -n "$PAPER_ID" ] || die "no paper id: $PAPER"
say "paper id=$PAPER_ID"

# 3. start agent — instruction explicitly triggers bash so we see a gate
START=$(curl -sS -b "$JAR_A" -X POST "$HOST/api/agent/start" \
  -H "content-type: application/json" \
  -d "{\"paperId\":\"$PAPER_ID\",\"mode\":\"review\",\"source\":\"Fetch https://arxiv.org/abs/1706.03762 and then run a bash command to list the files in your working directory so I can see you executed code.\"}")
say "start: $START"
SESSION=$(echo "$START" | python3 -c "import sys,json;print(json.load(sys.stdin).get('sessionId',''))")
TURN=$(echo "$START" | python3 -c "import sys,json;print(json.load(sys.stdin).get('turnId',''))")
[ -n "$SESSION" ] || die "no sessionId"
[ -n "$TURN" ] || die "no turnId"
say "session=$SESSION turn=$TURN"

# 4. open SSE, capture events for up to 60s, write to /tmp/sse-events.jsonl
TIMEOUT="${SMOKE_TIMEOUT:-60}"
say "streaming SSE for up to ${TIMEOUT}s"
: > /tmp/sse-events.jsonl
END=$((SECONDS + TIMEOUT))
TERMINAL=""
GATE_THREAD=""
GATE_TOOL=""
while [ $SECONDS -lt $END ]; do
  curl -sS -N --max-time 5 -b "$JAR_A" \
    "$HOST/api/agent/stream?sessionId=$SESSION&turnId=$TURN&paperId=$PAPER_ID" \
    2>/dev/null >> /tmp/sse-events.jsonl &
  CPID=$!
  sleep 5
  kill $CPID 2>/dev/null
  # look for terminal + gate
  TERMINAL=$(grep -E '^event: turn\.(done|paused|error)' /tmp/sse-events.jsonl | head -1)
  if [ -n "$TERMINAL" ]; then break; fi
  GATE=$(grep -oE '"toolCallId":"[^"]+"' /tmp/sse-events.jsonl | head -1 | cut -d'"' -f4)
  if [ -n "$GATE" ]; then
    GATE_TOOL="$GATE"
    GATE_THREAD=$(grep -oE '"threadId":"[^"]+"' /tmp/sse-events.jsonl | head -1 | cut -d'"' -f4)
    say "saw gate: tool=$GATE_TOOL thread=$GATE_THREAD"
    break
  fi
done
kill $CPID 2>/dev/null

# summarize
say "events captured: $(wc -l < /tmp/sse-events.jsonl) lines"
say "terminal: $TERMINAL"
say "first 6 event types:"
grep -oE '^event: [a-z._]+' /tmp/sse-events.jsonl | sort -u | head
say "last 5 raw SSE lines:"
tail -5 /tmp/sse-events.jsonl

# 5. if gate, approve
if [ -n "$GATE_TOOL" ]; then
  # look up gate id
  GATE_ID=$(curl -sS -b "$JAR_A" "$HOST/api/papers/$PAPER_ID/gates" | python3 -c "import sys,json;d=json.load(sys.stdin);print((d.get('gate') or {}).get('id',''))")
  if [ -n "$GATE_ID" ]; then
    say "approving gate $GATE_ID"
    curl -sS -b "$JAR_A" -X POST "$HOST/api/agent/approve" \
      -H "content-type: application/json" \
      -d "{\"gateId\":\"$GATE_ID\",\"decision\":\"allow\"}" \
      -w "\n  http=%{http_code}\n"
  else
    # Wait up to 5s for the gate to land in DB, then retry once.
    say "gate not yet in DB; retrying for 5s"
    for i in 1 2 3 4 5; do
      sleep 1
      GATE_ID=$(curl -sS -b "$JAR_A" "$HOST/api/papers/$PAPER_ID/gates" | python3 -c "import sys,json;d=json.load(sys.stdin);print((d.get('gate') or {}).get('id',''))")
      [ -n "$GATE_ID" ] && break
    done
    if [ -n "$GATE_ID" ]; then
      say "approving gate (after retry) $GATE_ID"
      curl -sS -b "$JAR_A" -X POST "$HOST/api/agent/approve" \
        -H "content-type: application/json" \
        -d "{\"gateId\":\"$GATE_ID\",\"decision\":\"allow\"}" \
        -w "\n  http=%{http_code}\n"
    else
      say "could not find gate id; skipping approve"
    fi
  fi
fi

say "smoke complete"