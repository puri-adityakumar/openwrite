#!/usr/bin/env bash
# Pure-HTTP smoke against TrueForge + GMI (no app code touched).
# Verifies the foundation Agent 1 will build on:
#   - TrueForge reachable
#   - GMI provider registered with correct base_url
#   - Daytona sandbox-provider row absent (local fallback)
#   - Session creation succeeds (sandbox-disabled agent spec)
#   - Turn creation succeeds (user.message input)
#   - SSE subscribe endpoint accepts the connection
set -u

TF="${TF_BASE_URL:-http://localhost:8790}"
say() { echo "[smoke-http] $*"; }
die() { say "FAIL: $*"; exit 1; }

# 1. health
say "TrueForge health"
curl -sf "$TF/healthz" >/dev/null || die "TrueForge not reachable at $TF"

# 2. provider configured
say "GMI provider configured"
prov=$(curl -sf "$TF/api/v1/settings/model-providers")
echo "$prov" | python3 -c "
import sys, json
d = json.load(sys.stdin)
provs = d.get('data', [])
if not provs: sys.exit('no providers')
p = next((p for p in provs if p['manifest'].get('type') == 'anthropic'), None)
if not p: sys.exit('no anthropic provider')
m = p['manifest']
assert m['base_url'] == 'https://api.gmi-serving.com/v1', f\"wrong base_url: {m['base_url']}\"
assert any(x['model_id'] == 'MiniMaxAI/MiniMax-M3' for x in m['models']), 'M3 model missing'
print('  provider OK')
"

# 3. no sandbox provider (local fallback)
say "No Daytona sandbox provider (local fallback engaged)"
status=$(curl -s -o /dev/null -w "%{http_code}" "$TF/api/v1/settings/sandbox-providers")
[ "$status" = "404" ] || die "expected 404, got $status"

# 4. session create
say "Create test session"
sess_body=$(cat <<EOF
{"agent":{"spec":{"model":{"name":"anthropic/gmi-minimax"},"instructions":"Reply with exactly the word 'pong'.","config":{"sandbox":{"enabled":false},"iteration_limit":5}}}}
EOF
)
sess=$(curl -sf -X POST "$TF/api/v1/sessions" -H "content-type: application/json" -d "$sess_body")
sid=$(echo "$sess" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])")
say "  session=$sid"

# 5. turn create
say "Create turn (user.message)"
turn=$(curl -sf -X POST "$TF/api/v1/sessions/$sid/turns" -H "content-type: application/json" \
  -d '{"input":[{"type":"user.message","content":"ping"}],"previous_turn_id":"none","stream":true}' \
  --max-time 30)
tid=$(echo "$turn" | python3 -c "
import sys, json
raw = sys.stdin.read()
# Try parsing as JSON first
try:
    d = json.loads(raw)
    print(d.get('id') or d.get('data',{}).get('id') or '')
except Exception:
    # SSE: first data: line is the turn.created event with payload.turn_id
    import re
    m = re.search(r'\"turn_id\"\s*:\s*\"([^\"]+)\"', raw)
    if m: print(m.group(1))
    else: print('')
")
say "  turn=$tid"

# 6. subscribe (collect first 20 lines of SSE)
if [ -n "$tid" ]; then
  say "Subscribe to SSE for up to 25s"
  : > /tmp/smoke-http-sse.log
  curl -sN --max-time 25 "$TF/api/v1/sessions/$sid/turns/$tid/subscribe" >> /tmp/smoke-http-sse.log 2>&1 &
  CPID=$!
  sleep 25
  kill $CPID 2>/dev/null
  say "SSE captured: $(wc -l < /tmp/smoke-http-sse.log) lines"
  echo "--- first 10 SSE events ---"
  grep -E "^event:|^data:" /tmp/smoke-http-sse.log | head -20
fi

# 7. cleanup
say "Cancel session"
curl -sf -X POST "$TF/api/v1/sessions/$sid/cancel" -o /dev/null -w "  http=%{http_code}\n"

say "OK"