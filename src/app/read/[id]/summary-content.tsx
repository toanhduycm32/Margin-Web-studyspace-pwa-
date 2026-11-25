type Block = { kind: "heading" | "paragraph" | "list"; lines: string[] };

function blocksFrom(text: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  const flush = () => { if (current) blocks.push(current); current = null; };
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const heading = line.match(/^#{1,4}\s+(.+)$/);
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (heading) { flush(); blocks.push({ kind: "heading", lines: [heading[1]] }); }
    else if (bullet) {
      if (current?.kind !== "list") flush();
      if (!current) current = { kind: "list", lines: [] };
      current.lines.push(bullet[1]);
    } else {
      if (current?.kind !== "paragraph") flush();
      if (!current) current = { kind: "paragraph", lines: [] };
      current.lines.push(line);
    }
  }
  flush();
  return blocks;
}

function emphasis(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part);
}

export default function SummaryContent({ text }: { text: string }) {
  return <div className="summary-body">{blocksFrom(text).map((block, index) => {
    if (block.kind === "heading") return <h3 key={index}>{emphasis(block.lines[0])}</h3>;
    if (block.kind === "list") return <ul key={index}>{block.lines.map((line, item) => <li key={item}>{emphasis(line)}</li>)}</ul>;
    return <p key={index}>{emphasis(block.lines.join(" "))}</p>;
  })}</div>;
}
