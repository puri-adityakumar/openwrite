// Phase 3.2 — GMI (LLM provider) client.
//
// The user provided a real GMI key in .env (gitignored). The key
// powers the Ask composer: free text + @cite tokens -> LLM answer
// with citations back into the Reader.
//
// GMI is OpenAI-compatible, so we use Node 18+'s native fetch. The
// base URL + model are read from env at call time so they can be
// changed without a redeploy.

export type GmiMessage = { role: "system" | "user" | "assistant"; content: string };

export type GmiRequest = {
  model?: string;
  messages: GmiMessage[];
  max_tokens?: number;
  temperature?: number;
};

export type GmiResponse = {
  id: string;
  choices: Array<{ message: { role: "assistant"; content: string } }>;
  usage?: { total_tokens: number };
};

function baseUrl(): string {
  return process.env.GMI_BASE_URL ?? "https://api.minimax.chat/v1";
}

function model(): string {
  return process.env.GMI_MODEL ?? "MiniMax-M3";
}

export function gmiConfigured(): boolean {
  const key = process.env.GMI_API_KEY;
  return !!key && key.length > 0 && key !== "replace-me";
}

export async function gmiChat(req: GmiRequest): Promise<GmiResponse> {
  const key = process.env.GMI_API_KEY;
  if (!key || key === "replace-me") {
    throw new Error("GMI_API_KEY is not configured");
  }
  const url = `${baseUrl()}/chat/completions`;
  const body = {
    model: req.model ?? model(),
    messages: req.messages,
    max_tokens: req.max_tokens ?? 512,
    temperature: req.temperature ?? 0.2,
  };
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`GMI ${resp.status}: ${detail.slice(0, 200)}`);
  }
  return (await resp.json()) as GmiResponse;
}
