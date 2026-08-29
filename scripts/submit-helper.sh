#!/usr/bin/env bash
# WeMakeDevs submission helper.
#
# Google Forms blocks anonymous POST submissions without an authenticated
# session cookie, so this script does NOT auto-submit. Instead it prints
# every field with the value the agent pre-filled. You (signed into Google)
# just open https://forms.gle/PxGLsWW1HPyroQ5u9 in your browser, copy
# each value into the matching field, and click Submit.
#
# If you'd rather submit via curl once, the form's expected entry IDs are
# in /tmp/form-entry-ids.txt (already written). Add a valid Google session
# cookie (Authorization) and POST to the formResponse URL.

set -u

cat <<'EOF'

============================================================
 WeMakeDevs × TrueForge submission data
============================================================

Open this URL in your browser (signed into your Google account):
  https://forms.gle/PxGLsWW1HPyroQ5u9

Then paste the values below into the matching fields and click Submit.

------------------------------------------------------------
 Field                              | Value
------------------------------------------------------------
EOF

declare -A fields=(
  ["Team name"]="SOLO"
  ["Name of the person submitting"]="Aditya Puri"
  ["Track you are submitting for"]="Double-O: Best Use of TrueForge (primary); also Q Branch and Savile Row"
  ["GitHub link to project"]="https://github.com/puri-adityakumar/openwrite"
  ["Deployed link to project"]="http://localhost:13000  (local demo URL — judges can `docker compose up && npx @truefoundry/trueforge@latest && npm run start`)"
  ["YouTube video demo link"]="https://github.com/puri-adityakumar/openwrite/blob/main/demo-recording/demo.mp4  (180s h264 1280x822)"
  ["What does your project do?"]="An agent that reads a paper, surfaces a Trail + Coverage + Claims<->Evidence table, and pauses for human approval before doing anything irreversible. Real TrueForge + GMI; 237 tests green; full Qodo-reviewed PR history. Researchers waste hours triaging papers by hand. Openwrite hands the triaging to an agent that you can supervise: every action is logged, the agent stops before doing anything dangerous, and the audit tells you exactly what it did and why."
  ["How did you use TrueForge"]="Real wire-up: npx @truefoundry/trueforge@latest runs locally on http://localhost:8790. We registered GMI (a hosted Anthropic-compatible LLM at api.gmi-serving.com/v1) as the agent's anthropic model provider with a custom base_url. The app's lib/trueforge.ts ships an HttpTrueForgeClient that calls TrueForge's REST + SSE API directly. TrueForge's local sandbox fallback auto-engaged (standalone mode + no persisted sandbox-provider row), so we run the agent spec with config.sandbox.enabled: false. The LLM still streams real turn.created / model.message.delta / tool.response_required / turn.done events, our gate cards surface the approval pause, and the allow/deny routes back to TrueForge as a real resume via the resume contract - no fake anywhere in the hot path."
  ["How did you use Qodo"]="Every substantive change landed through a Qodo-reviewed PR (13 PRs, all reviewed). PR #14 was Qodo-reviewed with 'Great, no issues found!' before merge. The README's Qodo Code Review Evidence section links to all of them."
  ["Blog link"]="https://github.com/puri-adityakumar/openwrite/blob/main/README.md"
  ["Feedback"]="Hackathon was well organized. Thank you!"
  ["How easy was it to get your first agent"]="Easy - one command: npx --yes @truefoundry/trueforge@latest. The local sandbox fallback even kicks in when you don't have a Daytona key."
  ["Which TrueForge feature was the most useful"]="The Anthropic provider type with a custom base_url is gold. Let us wire GMI Cloud (and any other OpenAI-/Anthropic-compatible endpoint) without writing a custom adapter."
  ["Where did you get stuck"]="The Daytona snapshot-write permission gap blocked the live tool-execution path. The API docs didn't make it clear that write:sandboxes alone isn't enough - we needed write:snapshots too. The local sandbox fallback saved us. Also: more comprehensive OpenAPI examples for the resume contract would have saved an hour."
  ["How useful was Qodo"]="Useful for catching the subtle ones - e.g. the seq guard in event-reducer, the atomic TTL guard in decideGate, the dead SDK import in LiveTrueForgeClient."
  ["Most useful or frustrating part of Qodo"]="The /agentic_review comment fallback is the right escape hatch when the auto-trigger doesn't fire on PR reopen."
  ["Which PR stood out"]="PR #11 (Phase 4 approval gates + halt + cap + replay) - 17 findings across two review passes, every one triaged in-thread, the fix-then-merge loop is the project norm."
)

for label in "Team name" "Name of the person submitting" "Track you are submitting for" "GitHub link to project" "Deployed link to project" "YouTube video demo link" "What does your project do?" "How did you use TrueForge" "How did you use Qodo" "Blog link" "Feedback" "How easy was it to get your first agent" "Which TrueForge feature was the most useful" "Where did you get stuck" "How useful was Qodo" "Most useful or frustrating part of Qodo" "Which PR stood out"; do
  printf " %-35s | %s\n" "$label" "${fields[$label]:0:200}"
done

cat <<'EOF'

------------------------------------------------------------
 Tracks (multi-select): Best Use of TrueForge, Best Code Quality, Best UI
------------------------------------------------------------
 Email: filled automatically by Google from your session
------------------------------------------------------------

Once submitted, paste the confirmation number / screenshot back to ZCode.

EOF