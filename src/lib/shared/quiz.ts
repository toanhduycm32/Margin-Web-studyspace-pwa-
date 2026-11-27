import type { LegacyQuizQuestion, MapRecord, QuizQuestion, QuizQuestionV2, ResponseType } from "./types";
import { QUESTION_FAMILIES, classifyStudyDomain } from "./study-rules";
import { MAX_QUESTION_BYTES } from "./limits";

const normalized = (text: string) => text.trim().toLocaleLowerCase().replace(/\s+/g, " ");

export function correctOptionIds(question: QuizQuestion): number[] {
  return "correctOptionIds" in question ? question.correctOptionIds : [question.answer];
}
export function responseType(question: QuizQuestion): ResponseType {
  return "responseType" in question ? question.responseType : "single_best";
}

// Preserve validation for previously saved single-answer resources.
export function validateQuestions(value: unknown, source: string, expected: number,
  startPage: number, endPage: number): LegacyQuizQuestion[] {
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
        !source.includes(item.source_excerpt)) throw new Error("Question has invalid options, answer, explanation, or source quote.");
    const key = normalized(item.question);
    if (seen.has(key)) throw new Error("Duplicate questions were generated.");
    seen.add(key);
    return { question: item.question.trim(), options: item.options.map((option) => String(option).trim()) as LegacyQuizQuestion["options"],
      answer: item.answer as number, explanation: item.explanation.trim(), sourceExcerpt: item.source_excerpt,
      startPage, endPage };
  });
}

export function validateQuestionsV2(value: unknown, source: string, formats: ResponseType[], families: string[],
  startPage: number, endPage: number): QuizQuestionV2[] {
  if (!Array.isArray(value) || value.length !== formats.length || formats.length !== families.length) {
    throw new Error(`Expected ${formats.length} complete assessment items.`);
  }
  const seen = new Set<string>();
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error("Assessment item is malformed.");
    const item = raw as Record<string, unknown>;
    const options = item.options;
    const keys = item.correct_option_ids;
    const explanations = item.option_explanations;
    if (!Array.isArray(keys)) throw new Error(`Item ${index + 1} omitted correct_option_ids.`);
    if (!Array.isArray(explanations)) throw new Error(`Item ${index + 1} omitted option_explanations.`);
    if (formats[index] === "single_best" && item.selection_count != null) {
      throw new Error(`Item ${index + 1} must set selection_count to null for single_best.`);
    }
    if (formats[index] === "select_n" && item.selection_count !== keys.length) {
      throw new Error(`Item ${index + 1} selection_count must equal correct_option_ids length.`);
    }
    if (typeof item.source_excerpt !== "string" || !source.includes(item.source_excerpt)) {
      throw new Error(`Item ${index + 1} must copy an exact contiguous source_excerpt.`);
    }
    if (item.response_type !== formats[index] || item.question_family !== families[index] ||
        !QUESTION_FAMILIES.includes(item.question_family as typeof QUESTION_FAMILIES[number]) ||
        !["remember", "understand", "apply", "analyze"].includes(String(item.cognitive_demand)) ||
        !["foundational", "intermediate", "advanced"].includes(String(item.difficulty)) ||
        typeof item.question !== "string" || item.question.trim().length < 18 ||
        !Array.isArray(options) || options.length < 4 || options.length > 6 ||
        options.some((option) => typeof option !== "string" || option.trim().length < 2) ||
        new Set(options.map((option) => normalized(String(option)))).size !== options.length ||
        !Array.isArray(keys) || keys.length < 1 || keys.length >= options.length ||
        keys.some((key) => !Number.isInteger(key) || key < 0 || key >= options.length) || new Set(keys).size !== keys.length ||
        (formats[index] === "single_best" && keys.length !== 1) ||
        (formats[index] !== "single_best" && keys.length < 2) ||
        (formats[index] === "select_n" && item.selection_count !== keys.length) ||
        (formats[index] !== "select_n" && item.selection_count != null) ||
        typeof item.explanation !== "string" || item.explanation.trim().length < 35 ||
        !Array.isArray(explanations) || explanations.length !== options.length ||
        explanations.some((part) => typeof part !== "string" || part.trim().length < 12) ||
        typeof item.source_excerpt !== "string" || item.source_excerpt.length < 8 ||
        !source.includes(item.source_excerpt)) {
      throw new Error("Assessment item has invalid evidence, answers, explanations or response format.");
    }
    const stem = normalized(item.question);
    if (classifyStudyDomain(source) !== "general") {
      const sourceTerms = normalized(source);
      const optionText = options.join(" ").toLowerCase();
      const drugs = optionText.match(/\b(?:amoxicillin|penicillin|clindamycin|azithromycin|doxycycline|ibuprofen|naproxen|acetaminophen|paracetamol|metformin|insulin|warfarin|apixaban)\b/g) || [];
      const regimens = optionText.match(/\b\d+(?:\.\d+)?[- ](?:mg|g|mcg|µg|days?|weeks?|months?|hours?)\b/g) || [];
      if ([...drugs, ...regimens].some((detail) => !sourceTerms.includes(normalized(detail)))) {
        throw new Error("Assessment item invented a clinical drug, dose or duration absent from the PDF source.");
      }
    }
    if (seen.has(stem)) throw new Error("Duplicate assessment items were generated.");
    seen.add(stem);
    const question: QuizQuestionV2 = { id: `${startPage}-${endPage}-${index + 1}`, responseType: formats[index],
      selectionCount: formats[index] === "select_n" ? keys.length : null,
      questionFamily: families[index], cognitiveDemand: item.cognitive_demand as QuizQuestionV2["cognitiveDemand"],
      difficulty: item.difficulty as QuizQuestionV2["difficulty"], question: item.question.trim(),
      options: options.map((part) => String(part).trim()), correctOptionIds: [...keys].sort((a, b) => a - b),
      explanation: item.explanation.trim(), optionExplanations: explanations.map((part) => String(part).trim()),
      sourceExcerpt: item.source_excerpt, startPage, endPage };
    if (new TextEncoder().encode(JSON.stringify(question)).byteLength > MAX_QUESTION_BYTES) {
      throw new Error(`Item ${index + 1} is too verbose. Shorten its explanation and source excerpt while preserving all necessary conditions.`);
    }
    return question;
  });
}

export function selectCoveredQuestions(maps: MapRecord[], count: number): QuizQuestion[] {
  if (maps.some((map) => map.schema === 3)) {
    const questions = maps.flatMap((map) => map.questions || []);
    if (questions.length !== count) throw new Error("Assessment blueprint could not be completed. Retry the quiz.");
    const seen = new Set<string>();
    for (const question of questions) {
      const key = normalized(question.question);
      if (seen.has(key)) throw new Error("Repeated assessment items were generated. Retry the quiz.");
      seen.add(key);
    }
    return questions.sort((a, b) => a.startPage - b.startPage);
  }
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
    chosen.push(selected.question); seen.add(normalized(selected.question.question)); usedChunk.add(selected.chunk);
  }
  return chosen.sort((a, b) => a.startPage - b.startPage);
}

export function normalizedAnswers(questions: QuizQuestion[], answers: unknown): number[][] {
  if (!Array.isArray(answers) || answers.length !== questions.length) throw new Error("Answer every question before submitting.");
  return questions.map((question, index) => {
    const raw = answers[index];
    const selected = typeof raw === "number" ? [raw] : raw;
    if (!Array.isArray(selected) || selected.length < 1 || selected.some((id) =>
      !Number.isInteger(id) || id < 0 || id >= question.options.length) || new Set(selected).size !== selected.length ||
      (responseType(question) === "single_best" && selected.length !== 1) ||
      (responseType(question) === "select_n" && selected.length !== (question as QuizQuestionV2).selectionCount)) {
      throw new Error("Answer every question using the required number of choices.");
    }
    return [...selected].sort((a, b) => a - b);
  });
}

export function scoreQuiz(questions: QuizQuestion[], answers: unknown): number {
  const selected = normalizedAnswers(questions, answers);
  return questions.reduce((total, question, index) => total + Number(JSON.stringify([...correctOptionIds(question)].sort((a, b) => a - b)) ===
    JSON.stringify(selected[index])), 0);
}
