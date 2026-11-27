import type { LearningObjective } from "@/lib/shared/types";
import { AssessmentValidationError } from "@/lib/shared/quiz";

export function summaryPassages(source: string, start: number, end: number) {
  const pages = source.split(/(?=^Page \d+\n)/m).filter(Boolean);
  if (source.length <= 6500 || pages.length < 2) return [{ text: source, start, end }];
  const parts: Array<{ text: string; start: number; end: number }> = [];
  for (const page of pages) {
    const number = Number(/^Page (\d+)\n/.exec(page)?.[1]) || start;
    const previous = parts.at(-1);
    if (previous && previous.text.length + page.length <= 6500) {
      previous.text += page; previous.end = number;
    } else parts.push({ text: page, start: number, end: number });
  }
  return parts;
}

export function focusedQuestionSource(source: string, objectives?: LearningObjective[]): string {
  if (!objectives?.length || source.length <= 8000) return source;
  const ranges = objectives.map((objective) => {
    const at = source.indexOf(objective.sourceExcerpt);
    if (at < 0) return null;
    const from = Math.max(0, at - 1800);
    const to = Math.min(source.length, at + objective.sourceExcerpt.length + 1800);
    const lineStart = source.lastIndexOf("\n", from);
    const lineEnd = source.indexOf("\n", to);
    return { from: lineStart < 0 ? 0 : lineStart + 1, to: lineEnd < 0 ? source.length : lineEnd };
  });
  if (ranges.some((range) => !range)) return source;
  const merged: Array<{ from: number; to: number }> = [];
  for (const range of ranges.filter((range) => !!range).sort((a, b) => a.from - b.from)) {
    const last = merged.at(-1);
    if (last && range.from <= last.to) last.to = Math.max(last.to, range.to);
    else merged.push({ ...range });
  }
  return merged.map((range) => source.slice(range.from, range.to)).join("\n[Đoạn nguồn khác cùng phần]\n");
}

export function indexedEvidence(source: string) {
  const passages = source.split("\n").map((line) => line.trim()).filter((line) => line.length >= 8 &&
    !line.startsWith("[Đoạn nguồn khác"));
  return { passages, text: passages.map((line, index) => `[E${index + 1}] ${line}`).join("\n") };
}

export function attachSourceExcerpts(items: unknown, passages: string[]): unknown {
  if (!Array.isArray(items)) return items;
  return items.map((item, index) => {
    if (!item || typeof item !== "object" || item.evidence_id === undefined) return item;
    const match = /^E([1-9]\d*)(?:\s*[-–]\s*E([1-9]\d*))?$/.exec(String(item.evidence_id).trim());
    const first = match ? Number(match[1]) : 0;
    const last = match ? Number(match[2] || match[1]) : 0;
    if (!first || last < first || last > passages.length) {
      throw new AssessmentValidationError(`Item ${index + 1} must choose an existing evidence_id from the supplied source.`);
    }
    return { ...item, source_excerpt: passages[first - 1].slice(0, 500) };
  });
}
