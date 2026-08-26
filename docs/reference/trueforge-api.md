# TrueForge Technical Reference (verified Aug 26, 2026)

- **Repo:** https://github.com/truefoundry/trueforge (MIT, TS/pnpm monorepo)
- **Docs:** https://trueforge.dev (LLM index at /llms.txt) · **UI playground:** https://ui.trueforge.dev/
- **No hosted/SaaS TrueForge.** "Hosted" means self-hosted. Runs locally via
  `npx @truefoundry/trueforge@latest` (port 8790; we override to **18790**) or
  via the official `docker-compose.yml` (Postgres + Redis inside). The repo
  ships `Dockerfile`, `docker-compose.yml`, and Helm charts.
- **No prebuilt image on Docker Hub or ghcr.io** (only a JFrog Helm OCI at
  `oci://trueforge`). We build from the official compose file.

## SDK — `@truefoundry/trueforge-sdk` v0.1.3 (Fern-generated)

`client.sessions.create/list/cancel`, `createTurnStream(sessionId, {input})`
(SSE async iterator), `createTurn`, `getTurn`, `listTurns`,
`subscribeToTurn(..., {afterSequenceNumber})`,
`listTurnEvents(sessionId, turnId, {order})`, `downloadSandboxFile`.

## UI SDK — `@truefoundry/trueforge-ui` v0.2.4

`<TrueForgeUI>` props: `server` (required; `{type:"trueforge", baseUrl, token?,
fetch?, catalog?}`), `layout` (required: `"sidebar"|"drawer"|"dock"|` custom
`ComponentType`), `agentConfig`, `theme`, `overrides` (AtomSlots),
`initialSessionId`, `adapters`, `onError`. Themes: `trueforge|claude|chatgpt|gemini`.
~60 type-checked slot overrides. A custom `layout` renders inside the full
provider stack — **the intended escape hatch for our custom mission-control shell.**

## SSE events

`turn.created`, `model.message`, `model.message.delta`, `tool.response`,
`tool.approval_required`, `tool.response_required`, `thread.created`,
`thread.done`, `mcp.initialize`, `mcp.auth_required`, `sandbox.created`,
terminal `turn.done` with `state` (done|cancelled|error) + `requiredActions` +
`metrics` (incl. `total_cost_in_usd`). Every event has a ULID id + sequence number.

## Approval flow

- `require_approval_for_tools: ["@write","@destructive"]` (resolved from MCP
  tool annotations; can be `@all`, `@read-only`, or literal names).
- `tool.approval_required` event shape:
  `{id, createdAt, threadId, toolCalls:[{id, sourceEventId}]}`.
- A paused turn's `turn.done.state` includes `requiredActions`.
- Resume = **new turn on the same `threadId`** with input item
  `user.tool_approval {threadId, toolCallId, approval:{status:"allow"}|{status:"deny",reason}}`.
  The new turn's input cannot mix approval with `user.message`.

## Sandbox (Daytona — the only provider today)

`config.sandbox.enabled` per agent. Skills and Code Mode require it; off by
default per agent. Files persist across turns; `sandbox.created` exposes
`sandboxId`. `downloadSandboxFile` for downloads. Egress control at the agent
config level.

## MCP catalog (14 servers — verified from mcp-catalog.yaml)

- **OAuth/DCR:** linear, notion, sentry, confluence, jira, stripe, posthog,
  supabase ("Run SQL queries, manage tables")
- **Header PAT/key:** github (`Authorization: Bearer YOUR_GITHUB_PAT`), tavily,
  bright-data
- **No auth:** deepwiki, exa (`mcp.exa.ai/mcp`), parallel-web
- Custom URL registration supported ("e.g., a Postgres or Supabase MCP")

## Generative UI

`openui` fenced blocks rendered through `@openuidev/react-lang` Renderer +
`@openuidev/react-ui`. Built-ins: layout (Stack, Tabs, Accordion, Steps,
Carousel, Modal, Separator), content (Card, CardHeader, TextContent,
MarkDownRenderer, Callout, TextCallout, Image, ImageBlock, ImageGallery,
CodeBlock, TagBlock), Table/Col (sortable/filterable), charts (BarChart,
LineChart, AreaChart, RadarChart, HorizontalBarChart, PieChart, RadialChart,
SingleStackedBarChart), Form, Buttons.

## Subagents

`create_sub_agent` builtin. One level deep, parallel, distinct `threadId`s.
`thread.created` carries `{threadId, title, agentInfo:{name,input,model?},
parent:{threadId,toolCallId}}`. Results appear as separate threads; only the
root talks to the user.

## Structured output

`response_format: {type:"json_schema", json_schema:{...}}` — **API-only**, set
on session create.

## Custom provider

Any OpenAI-compatible endpoint (vLLM/Ollama/gateways). Params forwarded as-is:
max_tokens, temperature, top_p, top_k, parallel_tool_calls, reasoning_effort.
**`total_cost_in_usd` is $0 for custom providers** — display "—", fall back to
`total_tokens`.

## Open items to verify at integration time

- **Replay/sandbox:** nothing documented says "force fresh sandbox." Most likely
  a new session gets a new sandbox automatically — **verify by inspecting the
  `sandbox.created` event on the replay session** during the day-one
  integration test (Phase 2) and again in Phase 5.
- **Approval TTL:** server-side, likely 5–30 min, not hours. Show a visible
  countdown; on expiry treat as `deny` with "approval expired — restart
  verification."

## TrueForge vs CopilotKit — decision rule (locked)

- **Use TrueForge-native** for any dashboard, panel, generative-UI, or
  chat-with-stream requirement.
- **CopilotKit only if** the core product is conversational co-driving of shared
  app state (a canvas co-edited across turns). It is not.
- **Switching cost:** CopilotKit needs an AG-UI protocol adapter over
  TrueForge's SSE (`@ag-ui/core` still v0.0.58, schema churn).
- **Hackathon call:** stay TrueForge-native; document CopilotKit as a
  post-hackathon evolution path.

Verified extension surface: ~60 slot overrides (`OpenUiFenceBlock`,
`ToolCallCard`, `ToolApprovalBar`, `SubAgentCard`, message bubbles, composer…);
custom `layout` inside the provider stack fed by SDK hooks (`useAuiState`,
`useTrueFoundryToolResponses`); arbitrary custom in-stream components via
`OpenUiFenceBlock` override + `defineComponent/createLibrary` (paths verified
end-to-end).
