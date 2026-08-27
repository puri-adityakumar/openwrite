// Phase 3.2 — GMI (LLM provider) client.
//
// GMI's API format (per the GMI Cloud console) is the Anthropic
// Messages API: POST /v1/messages with the `x-api-key` header and an
// `anthropic-version` header. The response shape mirrors Anthropic:
// `{ content: [{ type: "text", text: "…" }], usage: { input_tokens,
// output_tokens, … } }`.
//
// We expose a small `gmiChat` helper that returns a normalised
// `{ answer, usage }` so the Ask route doesn't have to know the
// provider's wire format. The base URL + model are read from env at
// call time.

export type GmiMessage = { role: "user" | "assistant"; content: string };

export type GmiRequest = {
  model?: string;
  system?: string;
  messages: GmiMessage[];
  max_tokens?: number;
  temperature?: number;
};

export type GmiResult = {
  answer: string;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
};

function baseUrl(): string {
  // GMI_BASE_URL is expected to include the /v1 prefix
  // (e.g. "https://api.gmi-serving.com/v1"). We append the resource
  // path below. Default keeps the /v1 prefix.
  return (process.env.GMI_BASE_URL ?? "https://api.gmi-serving.com/v1").replace(/\/+$/, "");
}

function model(): string {
  return process.env.GMI_MODEL ?? "MiniMaxAI/MiniMax-M3";
}

export function gmiConfigured(): boolean {
  const key = process.env.GMI_API_KEY;
  return !!key && key.length > 0 && key !== "replace-me";
}

export async function gmiChat(req: GmiRequest): Promise<GmiResult> {
  const key = process.env.GMI_API_KEY;
  if (!key || key === "replace-me") {
    throw new Error("GMI_API_KEY is not configured");
  }
  const url = `${baseUrl()}/messages`;
  const body = {
    model: req.model ?? model(),
    max_tokens: req.max_tokens ?? 512,
    temperature: req.temperature ?? 0.2,
    system: req.system,
    messages: req.messages,
  };
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`GMI ${resp.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await resp.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const answer =
    (data.content ?? [])
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text as string)
      .join("") || "";
  const inT = data.usage?.input_tokens ?? 0;
  const outT = data.usage?.output_tokens ?? 0;
  return {
    answer,
    usage: { inputTokens: inT, outputTokens: outT, totalTokens: inT + outT },
  };
}
