"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Md } from "./md";
import type { CiteToken } from "../lib/cite";

// Conversation Ask — the composer at the bottom of the Harness pane.
//
// ChatGPT-style: the full Q&A history renders above the composer as
// turns (user bubble, agent answer), Enter sends, Shift+Enter breaks
// the line, and the textarea grows up to six rows. The backend stays
// the single-shot /ask endpoint — each turn posts one question.

type AskTurn =
  | { role: "user"; text: string }
  | { role: "agent"; text: string };

export function Ask({
  paperId,
  onCite,
}: {
  paperId: string;
  onCite: (claimId: string) => void;
}) {
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  async function send() {
    const question = draft.trim();
    if (!question || pending) return;
    setPending(true);
    setError(null);
    setDraft("");
    if (taRef.current) taRef.current.style.height = "auto";
    setTurns((t) => [...t, { role: "user", text: question }]);
    try {
      const r = await fetch(`/api/papers/${paperId}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = (await r.json()) as {
        ok: boolean;
        answer?: string;
        error?: string;
        cites?: CiteToken[];
      };
      if (!r.ok || !data.ok) {
        setError(data.error ?? `HTTP ${r.status}`);
      } else {
        setTurns((t) => [...t, { role: "agent", text: data.answer ?? "" }]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send();
  }

  // ChatGPT behavior: Enter sends, Shift+Enter inserts a newline.
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  // Auto-grow to ~6 rows, then scroll.
  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }

  function renderAnswer(text: string) {
    const parts: Array<React.ReactNode> = [];
    const re = /\[claim\s+([0-9a-f-]+)\]/g;
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIndex) parts.push(<Md key={`t-${key}`} text={text.slice(lastIndex, m.index)} />);
      const claimId = m[1]!;
      parts.push(
        <button
          key={`cite-${key++}`}
          type="button"
          data-testid="answer-citation"
          data-claim-id={claimId}
          onClick={() => onCite(claimId)}
          className="ask-cite"
        >
          [cite]
        </button>,
      );
      lastIndex = re.lastIndex;
    }
    if (lastIndex < text.length) parts.push(<Md key={`t-${key}`} text={text.slice(lastIndex)} />);
    return parts;
  }

  return (
    <form onSubmit={onSubmit} className="ask-block ask-flow" data-testid="ask-composer">
      {turns.length > 0 && (
        <div className="ask-turns" data-testid="ask-turns">
          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="ask-turn ask-turn-user" data-testid="ask-turn-user">
                {t.text}
              </div>
            ) : (
              <div key={i} className="ask-turn ask-turn-agent" data-testid="ask-turn-agent">
                <div className="ask-turn-agent-body" data-testid="ask-answer">
                  {renderAnswer(t.text)}
                </div>
              </div>
            ),
          )}
          {pending && (
            <div className="ask-typing" aria-label="The agent is composing an answer">
              <span /><span /><span />
            </div>
          )}
        </div>
      )}

      <div className="ask-row">
        <textarea
          id="ask-input"
          ref={taRef}
          rows={1}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            autoGrow(e.target);
          }}
          onKeyDown={onKeyDown}
          placeholder="Ask this paper…"
          className="ask-textarea"
          data-testid="ask-input"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          aria-busy={pending}
          aria-label="Send question"
          className="ask-send"
          data-testid="ask-submit"
        >
          {pending ? <span className="btn-spinner" aria-hidden="true" /> : "↑"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-[var(--color-destructive)]" data-testid="ask-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
