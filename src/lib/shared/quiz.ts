import type { MapRecord, QuizQuestion } from "./types";

function normalized(text: string): string { return text.trim().toLocaleLowerCase().replace(/\s+/g, " "); }

export function validateQuestions(value: unknown, source: string, expected: number,
  startPage: number, endPage: number): QuizQuestion[] {
  if (!Array.isArray(value) || value.length !== expected) throw new Error(`Expected ${expected} complete questions.`);
  const seen = new Set<string>();
  return value.map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("Question is malformed.");
    const item = raw as Record<string, unknown>;
    if (typeof item.question !== "string" || item.question.trim().length < 15 ||
        !Array.isArray(item.options) || item.options.length !== 4 ||
        item.options.some((option) => typeof option !== "string" || option.trim().length < 2) ||
        new Set(item.options.map((option) => normalized(String(option)))).size !== 4 ||
        !Number.isInteger(item.answer) || (item.answer as number) < 0 || (item.answer as number) > 3 ||
        typeof item.explanation !== "string" || item.explanation.trim().length < 15 ||
        typeof item.source_excerpt !== "string" || item.source_excerpt.length < 8 ||
        !source.includes(item.source_excerpt)) {
      throw new Error("Question has invalid options, answer, explanation, or source quote.");
    }
    const key = normalized(item.question);
    if (seen.has(key)) throw new Error("Duplicate questions were generated.");
    seen.add(key);
    return { question: item.question.trim(), options: item.options.map((option) => String(option).trim()) as QuizQuestion["options"],
      answer: item.answer as number, explanation: item.explanation.trim(), sourceExcerpt: item.source_excerpt,
      startPage, endPage };
  });
}

export function selectCoveredQuestions(maps: MapRecord[], count: number): QuizQuestion[] {
  const byChunk = maps.map((map) => map.questions || []);
  const seen = new Set<string>();
  const chosen: QuizQuestion[] = [];
  const usedChunk = new Set<number>();
  for (let slot = 0; slot < count; slot++) {
    const target = Math.min(maps.length - 1, Math.floor((slot + 0.5) * maps.length / count));
    let selected: { chunk: number; question: QuizQuestion } | null = null;
    for (const preferNew of [true, false]) {
      for (let distance = 0; distance < maps.length && !selected; distance++) {
        for (const chunk of [target - distance, target + distance]) {
          if (chunk < 0 || chunk >= maps.length || (preferNew && usedChunk.has(chunk))) continue;
          const candidate = byChunk[chunk].find((question) => !seen.has(normalized(question.question)));
          if (candidate) { selected = { chunk, question: candidate }; break; }
        }
      }
      if (selected) break;
    }
    if (!selected) throw new Error("Not enough distinct, source-backed questions. Try a smaller quiz.");
    chosen.push(selected.question);
    seen.add(normalized(selected.question.question));
    usedChunk.add(selected.chunk);
  }
  return chosen.sort((a, b) => a.startPage - b.startPage);
}

export function scoreQuiz(questions: QuizQuestion[], answers: number[]): number {
  if (!Array.isArray(answers) || answers.length !== questions.length ||
      answers.some((answer) => !Number.isInteger(answer) || answer < 0 || answer > 3)) {
    throw new Error("Answer every question before submitting.");
  }
  return questions.reduce((total, question, index) => total + Number(question.answer === answers[index]), 0);
}
