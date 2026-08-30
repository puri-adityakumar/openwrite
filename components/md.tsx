import type { ReactNode } from "react";

// Minimal, dependency-free markdown for the agent's chat bubbles.
//
// The model's prose (streamed via model.message.delta into the pulse)
// uses a small subset: ## / ### headings, **bold**, `inline code`,
// - / 1. lists, and ``` fenced blocks. This renders exactly that subset
// to React nodes — never innerHTML — so model output cannot inject
// markup into the page.

const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

function renderInline(text: string, keyBase: string): ReactNode[] {
  return text.split(INLINE_RE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${keyBase}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={`${keyBase}-${i}`}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export function Md({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let fence: { lang: string; lines: string[] } | null = null;
  let k = 0;

  const flushPara = () => {
    if (para.length === 0) return;
    const body = para.join("\n");
    para = [];
    blocks.push(<p key={`p-${k++}`}>{renderInline(body, `p${k}`)}</p>);
  };
  const flushList = () => {
    if (!list) return;
    const current = list;
    list = null;
    const items = current.items.map((it, i) => (
      <li key={i}>{renderInline(it, `li${k}-${i}`)}</li>
    ));
    blocks.push(
      current.ordered ? <ol key={`l-${k++}`}>{items}</ol> : <ul key={`l-${k++}`}>{items}</ul>,
    );
  };
  const flushAll = () => { flushPara(); flushList(); };

  for (const raw of lines) {
    const line = raw.trimEnd();

    const fenceMark = line.match(/^```(\w*)/);
    if (fenceMark) {
      if (fence) {
        const done = fence;
        fence = null;
        blocks.push(
          <pre key={`f-${k++}`} className="md-pre" data-lang={done.lang || undefined}>
            <code>{done.lines.join("\n")}</code>
          </pre>,
        );
      } else {
        flushAll();
        fence = { lang: fenceMark[1] ?? "", lines: [] };
      }
      continue;
    }
    if (fence) {
      fence.lines.push(raw);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushAll();
      const Tag = (heading[1]!.length <= 2 ? "h3" : "h4") as "h3" | "h4";
      blocks.push(<Tag key={`h-${k++}`}>{renderInline(heading[2]!, `h${k}`)}</Tag>);
      continue;
    }

    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) {
      flushPara();
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(ul[1]!);
      continue;
    }

    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      flushPara();
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push(ol[1]!);
      continue;
    }

    if (line.trim() === "") {
      flushAll();
      continue;
    }
    para.push(line);
  }

  // Unterminated fence (the stream cut mid-block): render what arrived.
  if (fence) {
    blocks.push(
      <pre key={`f-${k++}`} className="md-pre">
        <code>{fence.lines.join("\n")}</code>
      </pre>,
    );
  }
  flushAll();

  return <div className="md">{blocks}</div>;
}
