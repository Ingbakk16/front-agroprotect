import type { ReactNode } from "react";

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*.+?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

/** Texto del asistente: listas, ## títulos, **negrita** — sin dependencia markdown. */
export function AssistantMessageContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  let i = 0;
  let paraBuf: string[] = [];

  const flushPara = () => {
    if (paraBuf.length === 0) return;
    const t = paraBuf.join("\n").trim();
    if (t) {
      nodes.push(
        <p
          key={nodes.length}
          className="my-1.5 first:mt-0 leading-relaxed text-foreground/95"
        >
          {renderInline(t)}
        </p>
      );
    }
    paraBuf = [];
  };

  const bulletRe = /^(\s*[-*]|\s*\d+\.)\s+/;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (trimmed.startsWith("### ")) {
      flushPara();
      nodes.push(
        <h4
          key={nodes.length}
          className="mt-2.5 mb-1 font-semibold text-foreground/95 first:mt-0 text-[13px]"
        >
          {renderInline(trimmed.slice(4))}
        </h4>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushPara();
      nodes.push(
        <h4
          key={nodes.length}
          className="mt-3 mb-1.5 font-semibold text-foreground first:mt-0 border-b border-border/40 pb-1 text-[13px]"
        >
          {renderInline(trimmed.slice(3))}
        </h4>
      );
      i++;
      continue;
    }

    if (bulletRe.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && bulletRe.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(bulletRe, "").trim());
        i++;
      }
      nodes.push(
        <ul
          key={nodes.length}
          className="my-2 list-disc space-y-1.5 pl-4 text-[13px] marker:text-primary/80"
        >
          {items.map((item, j) => (
            <li key={j} className="leading-relaxed text-foreground/95">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    paraBuf.push(line);
    i++;
  }
  flushPara();

  return <div className="text-sm">{nodes}</div>;
}
