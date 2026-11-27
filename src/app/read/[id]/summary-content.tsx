type Block = { kind: "heading" | "paragraph" | "list" | "table"; lines: string[]; level?: number };

function blocksFrom(text: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  const flush = () => { if (current) blocks.push(current); current = null; };
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (heading) { flush(); blocks.push({ kind: "heading", lines: [heading[2]], level: heading[1].length }); }
    else if (/^\|.+\|$/.test(line)) {
      if (current?.kind !== "table") flush();
      if (!current) current = { kind: "table", lines: [] };
      if (!/^\|[\s:|-]+\|$/.test(line)) current.lines.push(line);
    } else if (bullet) {
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
    if (block.kind === "heading") return (block.level || 2) <= 2 ? <h3 key={index}>{emphasis(block.lines[0])}</h3>
      : block.level === 3 ? <h4 key={index}>{emphasis(block.lines[0])}</h4> : <h5 key={index}>{emphasis(block.lines[0])}</h5>;
    if (block.kind === "list") return <ul key={index}>{block.lines.map((line, item) => <li key={item}>{emphasis(line)}</li>)}</ul>;
    if (block.kind === "table") {
      const rows = block.lines.map((line) => line.slice(1, -1).split("|").map((cell) => cell.trim()));
      return <div className="summary-table" key={index}><table><thead><tr>{rows[0]?.map((cell, cellIndex) => <th scope="col" key={cellIndex}>{emphasis(cell)}</th>)}</tr></thead>
        <tbody>{rows.slice(1).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{emphasis(cell)}</td>)}</tr>)}</tbody></table></div>;
    }
    return <p key={index}>{emphasis(block.lines.join(" "))}</p>;
  })}</div>;
}
