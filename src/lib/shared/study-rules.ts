import type { ResponseType } from "./types";

export const STUDY_RULE_VERSION = "2026-11-25-1";

export const SUMMARY_PROFILES = {
  concise: {
    label: "Concise",
    purpose: "Fast review",
    audience: "A learner revisiting material already read",
    voice: "Direct, neutral, information-dense",
    tone: "Precise without filler",
    minWords: 65, baseWords: 115, maxWords: 190,
    depth: "Retain the central claim, essential definitions, relationships and conclusions; omit repeated examples.",
    terminology: "Keep source terminology and define only essential terms.",
    formulas: "Preserve formulas only when necessary to retain the central meaning; never invent notation.",
    examples: "Use a source example only when it explains an otherwise unclear idea.",
    assumptions: "Retain qualifications that would change the claim if omitted.",
    limitations: "State material limitations and extraction gaps.",
    format: "Use coherent compact paragraphs under the source section heading; use lists only for genuine comparisons.",
    attribution: "Ground every claim in the supplied pages; do not attribute inferred headings to the PDF.",
    validation: "Check central meaning, necessary conditions, page support and excessive repetition.",
    exceptions: "A very short source section can be shorter than the target; never pad it.",
  },
  academic: {
    label: "Academic",
    purpose: "A complete university-level overview",
    audience: "A learner building a reliable first understanding",
    voice: "Clear, technically precise and explanatory",
    tone: "Academic but readable",
    minWords: 140, baseWords: 260, maxWords: 390,
    depth: "Explain important concepts, mechanisms, relationships, conclusions and representative source examples.",
    terminology: "Preserve technical vocabulary and define terms when the source defines them.",
    formulas: "Keep supported formulas, variable meanings, conditions and mathematical relationships.",
    examples: "Use only important examples actually present in the source.",
    assumptions: "State premises and conditions needed for correct interpretation.",
    limitations: "Preserve the author's limits, uncertainty and extraction gaps.",
    format: "Write connected paragraphs under meaningful section headings, avoiding fragmented micro-bullets.",
    attribution: "Use the supplied page range as evidence; do not present external knowledge as source content.",
    validation: "Check section coverage, conceptual relationships, technical accuracy and unsupported claims.",
    exceptions: "Scale down for sparse sections and up for unusually dense sections without padding.",
  },
  deep: {
    label: "Deep study",
    purpose: "Understanding difficult technical material",
    audience: "A learner who needs mechanisms and intermediate reasoning",
    voice: "Analytical and pedagogically explanatory",
    tone: "Rigorous and patient",
    minWords: 260, baseWords: 470, maxWords: 720,
    depth: "Explain definitions, mechanisms, intermediate relationships, cross-links and conclusions in detail.",
    terminology: "Define source terms and preserve meaningful distinctions.",
    formulas: "Retain supported notation, define symbols from the source and explain transformations and assumptions.",
    examples: "Explain important source examples and why they illustrate the concept.",
    assumptions: "Make prerequisites, boundary conditions and exceptions explicit.",
    limitations: "State limitations, uncertainty and any visual or scanned content not interpreted.",
    format: "Use substantial coherent paragraphs, short lists for true steps and tables only for useful comparisons.",
    attribution: "Keep all factual claims tied to the supplied pages; label inferred structure.",
    validation: "Check mechanisms, formulas, assumptions, relations, page support and clarity.",
    exceptions: "Do not invent a worked example or lengthen thin material to meet a target.",
  },
  revision: {
    label: "Revision notes",
    purpose: "Efficient recall and retrieval",
    audience: "A learner reviewing before practice",
    voice: "Compact and exact",
    tone: "Recall-oriented",
    minWords: 75, baseWords: 150, maxWords: 240,
    depth: "Prioritize definitions, distinctions, mechanisms, formulas and necessary conditions.",
    terminology: "Keep technical terms and concise source-backed definitions.",
    formulas: "Keep supported formulas with variable meanings and conditions.",
    examples: "Include only a source example that prevents a likely confusion.",
    assumptions: "Flag commonly confused conditions and exceptions when supported.",
    limitations: "Note material uncertainty and extraction gaps.",
    format: "Use compact bullets or a table when they improve scanning; avoid shallow flashcard fragments.",
    attribution: "Ground each note in the supplied page range and label inferred headings.",
    validation: "Check accuracy, recall usefulness, necessary qualifications and redundancy.",
    exceptions: "A thin section may use fewer words than the nominal target.",
  },
} as const;

export type SummaryProfile = keyof typeof SUMMARY_PROFILES;

export function summaryProfile(value: unknown): SummaryProfile {
  if (typeof value !== "string" || !(value in SUMMARY_PROFILES)) throw new Error("Choose a valid summary style.");
  return value as SummaryProfile;
}

export function sectionWordTarget(profile: SummaryProfile, characters: number): number {
  const rules = SUMMARY_PROFILES[profile];
  const scaled = Math.round(rules.baseWords * Math.sqrt(Math.max(100, characters) / 8_000));
  return Math.max(characters >= 4000 ? rules.minWords : 35, Math.min(rules.maxWords, scaled));
}

export function summaryInstruction(profile: SummaryProfile): string {
  const rule = SUMMARY_PROFILES[profile];
  return [rule.purpose, `Audience: ${rule.audience}.`, `Voice: ${rule.voice}. Tone: ${rule.tone}.`,
    rule.depth, rule.terminology, rule.formulas, rule.examples, rule.assumptions, rule.limitations,
    rule.format, rule.attribution, rule.validation, rule.exceptions].join(" ");
}

export const QUESTION_FAMILIES = ["definition", "mechanism", "application", "comparison",
  "assumption", "error_analysis", "boundary_condition", "cross_concept"] as const;

export const QUESTION_FAMILY_RULES: Record<typeof QUESTION_FAMILIES[number], string> = {
  definition: "Test a source-defined term or distinction, not an isolated word match; use confusions with neighboring terms as distractors.",
  mechanism: "Ask why or how a process works under stated conditions; wrong options should reverse a step, cause or direction.",
  application: "Give a compact new scenario solvable using the source's rule; wrong options should misuse that rule or omit a condition.",
  comparison: "Compare two source concepts on the same dimension; wrong options should swap their properties or exaggerate a difference.",
  assumption: "Ask which conditions are necessary for a source claim; wrong options should violate or overstate those conditions.",
  error_analysis: "Present a plausible learner error and ask what is wrong or how to correct it; distractors should reflect other realistic errors.",
  boundary_condition: "Test where a rule stops applying or what limitation changes the conclusion; avoid obscure exceptions absent from the source.",
  cross_concept: "Connect two source-supported ideas with an explicit reasoning bridge; do not invent a relationship the source cannot support.",
};

export function responseTargets(count: number): ResponseType[] {
  const all = Math.round(count * 0.5);
  const selectN = Math.round(count * 0.2);
  const remaining = count - all - selectN;
  const pool: ResponseType[] = [
    ...Array<ResponseType>(all).fill("select_all"),
    ...Array<ResponseType>(selectN).fill("select_n"),
    ...Array<ResponseType>(remaining).fill("single_best"),
  ];
  // Spread formats over the assessment rather than grouping identical controls.
  return interleave(pool);
}

function interleave(pool: ResponseType[]): ResponseType[] {
  const groups: ResponseType[][] = ["select_all", "single_best", "select_n"].map((type) => pool.filter((item) => item === type));
  const result: ResponseType[] = [];
  while (result.length < pool.length) {
    for (const group of groups) if (group.length) result.push(group.shift()!);
  }
  return result;
}

export type BlueprintChunk = { sectionId: string; characters: number; conceptSignals: number };

export function allocateQuizBlueprint(chunks: BlueprintChunk[], count: number): Array<{ formats: ResponseType[]; families: string[] }> {
  if (!chunks.length || count < 1) throw new Error("A readable PDF is required.");
  const result = chunks.map(() => ({ formats: [] as ResponseType[], families: [] as string[] }));
  const sectionOrder = [...new Set(chunks.filter((chunk) => chunk.characters > 0).map((chunk) => chunk.sectionId))];
  if (!sectionOrder.length) throw new Error("No readable PDF text was found. OCR is needed.");
  const sectionWeight = sectionOrder.map((id) => chunks.reduce((sum, chunk) => chunk.sectionId === id
    ? sum + Math.sqrt(Math.max(1, chunk.characters)) * (1 + Math.min(0.5, chunk.conceptSignals / 10)) : sum, 0));
  const sectionSlots = sectionOrder.map(() => 0);
  const chunkSlots = chunks.map(() => 0);
  const formats = responseTargets(count);
  for (let slot = 0; slot < count; slot++) {
    let section = 0;
    if (slot < sectionOrder.length && count >= sectionOrder.length) section = slot;
    else for (let index = 1; index < sectionOrder.length; index++) {
      if (sectionWeight[index] / (sectionSlots[index] + 1) > sectionWeight[section] / (sectionSlots[section] + 1)) section = index;
    }
    sectionSlots[section]++;
    const candidates = chunks.map((chunk, index) => chunk.sectionId === sectionOrder[section] && chunk.characters > 0 ? index : -1).filter((index) => index >= 0);
    let chosen = candidates[0];
    for (const index of candidates.slice(1)) {
      const value = Math.sqrt(Math.max(1, chunks[index].characters)) * (1 + Math.min(0.5, chunks[index].conceptSignals / 10)) / (chunkSlots[index] + 1);
      const current = Math.sqrt(Math.max(1, chunks[chosen].characters)) * (1 + Math.min(0.5, chunks[chosen].conceptSignals / 10)) / (chunkSlots[chosen] + 1);
      if (value > current) chosen = index;
    }
    chunkSlots[chosen]++;
    result[chosen].formats.push(formats[slot]);
    result[chosen].families.push(QUESTION_FAMILIES[slot % QUESTION_FAMILIES.length]);
  }
  return result;
}
