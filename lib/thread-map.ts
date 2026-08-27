// Phase 2.2 — threadId -> {role, parentThreadId} map.
//
// P7#5 (binding): the subagent role prefix in the Pulse ("[reader]",
// "[verifier]", "[searcher]") MUST come from a map built at
// `create_sub_agent` time — never from parsing event text.
//
// TrueForge emits:
//   thread.created  { threadId, title, agentInfo:{name,input,model?},
//                     parent:{threadId,toolCallId} }
//
// The `name` from agentInfo (e.g. "reader", "verifier", "searcher") is
// the role. We map it from `title` as a fallback because the live
// TrueForge server doesn't always populate agentInfo.name.
//
// In-memory only per run; not persisted. The audit row carries the
// resolved role so the audit timeline stays readable after the run ends.

const ROLE_KEYWORDS: Array<{ role: string; match: RegExp }> = [
  { role: "reader", match: /(reader|read|parse)/i },
  { role: "searcher", match: /(search|exa|related|cited)/i },
  { role: "verifier", match: /(verif|repro|replicat)/i },
  { role: "extractor", match: /(extract|claim)/i },
  { role: "scorer", match: /(scor|rank)/i },
  { role: "summarizer", match: /(summari[sz]e|tl;?dr)/i },
];

export function inferRoleFromTitle(title: string): string {
  for (const { role, match } of ROLE_KEYWORDS) {
    if (match.test(title)) return role;
  }
  return "agent";
}

export class ThreadMap {
  private byThread = new Map<string, { role: string; parentThreadId: string | null }>();

  register(threadId: string, info: { title?: string; agentInfo?: { name?: string }; parentThreadId?: string | null }): string {
    const role = info.agentInfo?.name ?? (info.title ? inferRoleFromTitle(info.title) : "agent");
    this.byThread.set(threadId, { role, parentThreadId: info.parentThreadId ?? null });
    return role;
  }

  resolve(threadId: string): string | undefined {
    return this.byThread.get(threadId)?.role;
  }

  // Snapshot for the reducer (Map<string,string>).
  snapshot(): Map<string, string> {
    const out = new Map<string, string>();
    for (const [id, v] of this.byThread) out.set(id, v.role);
    return out;
  }

  size(): number {
    return this.byThread.size;
  }
}
