import type { ResponseType } from "./types";

export const STUDY_RULE_VERSION = "2026-11-27-medical-4";

export type StudyDomain = "general" | "medical" | "dental";

// Require several independent signals: an isolated mention of a patient or tooth does not
// turn an unrelated document into a clinical source. This classification is planning only.
const domainSignals = {
  dental: /(?<![\p{L}\p{N}_])(?:dentistry|dental|tooth|teeth|pulpitis|periodont\w*|endodont\w*|caries|gingiv\w*|occlus\w*|oral cavity|nha khoa|răng|nướu|tủy răng|sâu răng)(?![\p{L}\p{N}_])/giu,
  medical: /(?<![\p{L}\p{N}_])(?:medicine|medical|patients?|diagnos\w*|symptom\w*|disease\w*|treatment\w*|therapy|clinical|patholog\w*|physiolog\w*|pharmacolog\w*|contraindicat\w*|ferritin|anemia|iron deficiency|inflammation|infection|y khoa|bệnh nhân|chẩn đoán|điều trị|triệu chứng|bệnh học|dược lý)(?![\p{L}\p{N}_])/giu,
};

export function classifyStudyDomain(text: string): StudyDomain {
  text = text.normalize("NFC");
  const dental = (text.match(domainSignals.dental) || []).length;
  const medical = (text.match(domainSignals.medical) || []).length;
  if (dental >= 3 && dental >= medical * 0.35) return "dental";
  if (medical >= 4 || dental >= 3) return "medical";
  return "general";
}

export const SUMMARY_PROFILES = {
  concise: {
    label: "Quick",
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
    label: "Deep medical study",
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
    label: "Exam revision",
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
  clinical: {
    label: "Clinical review",
    purpose: "Explain source-supported clinical reasoning for study",
    audience: "A medical or dental learner reviewing mechanisms and decisions",
    voice: "Careful, conditional and evidence-aware",
    tone: "Clinical education, never patient-specific advice",
    minWords: 180, baseWords: 330, maxWords: 530,
    depth: "Connect presentation, mechanism, differential, investigation and management only where the source supports each link.",
    terminology: "Preserve exact disease, anatomy, test and intervention terms; define ambiguous abbreviations from the source.",
    formulas: "Keep supported thresholds, units and calculations together with population and conditions.",
    examples: "Explain source cases as educational examples; do not invent patient findings.",
    assumptions: "Keep age, setting, severity, contraindications, exclusions and time course when they change interpretation.",
    limitations: "Label uncertainty, dated recommendations, missing visual findings and absent evidence explicitly.",
    format: "Use concise sections for presentation, reasoning, investigations and management only when supported; otherwise explain the available concepts.",
    attribution: "Separate what the PDF says from any external evidence; never invent a guideline or page citation.",
    validation: "Check every clinical action against its stated population, indication and exception.",
    exceptions: "Do not force a diagnosis or treatment pathway into basic science material.",
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
  "assumption", "error_analysis", "boundary_condition", "cross_concept",
  "clinical_presentation", "diagnostic_reasoning", "investigation", "management",
  "contraindication", "integrated_case"] as const;

export const CLINICAL_FAMILIES = ["mechanism", "clinical_presentation", "diagnostic_reasoning",
  "investigation", "management", "contraindication", "integrated_case"] as const;

export const QUESTION_FAMILY_RULES: Record<typeof QUESTION_FAMILIES[number], string> = {
  definition: "Test a source-defined term or distinction, not an isolated word match; use confusions with neighboring terms as distractors.",
  mechanism: "Ask why or how a process works under stated conditions; wrong options should reverse a step, cause or direction.",
  application: "Give a compact new scenario solvable using the source's rule; wrong options should misuse that rule or omit a condition.",
  comparison: "Compare two source concepts on the same dimension; wrong options should swap their properties or exaggerate a difference.",
  assumption: "Ask which conditions are necessary for a source claim; wrong options should violate or overstate those conditions.",
  error_analysis: "Present a plausible learner error and ask what is wrong or how to correct it; distractors should reflect other realistic errors.",
  boundary_condition: "Test where a rule stops applying or what limitation changes the conclusion; avoid obscure exceptions absent from the source.",
  cross_concept: "Connect two source-supported ideas with an explicit reasoning bridge; do not invent a relationship the source cannot support.",
  clinical_presentation: "Use supported signs, symptoms and time course to test recognition; do not add unprovided discriminating findings.",
  diagnostic_reasoning: "Require a differential or diagnosis justified by the stated presentation, test findings and population; state missing information when decisive.",
  investigation: "Ask what a supported test establishes or fails to establish; preserve test timing, units and interpretation limits.",
  management: "Test a source-supported management principle with its indication, population, setting and alternatives; never imply universal treatment.",
  contraindication: "Test a supported exclusion, adverse effect or safety condition; distinguish absolute from conditional limitations.",
  integrated_case: "Connect two or more supported clinical concepts in a short educational case without inventing a medically consequential premise.",
};

export function responseTargets(count: number): ResponseType[] {
  const all = Math.round(count * 0.6);
  const selectN = Math.round(count * 0.15);
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

export function recommendedQuestionCount(chunks: BlueprintChunk[]): number {
  const readable = chunks.filter((chunk) => chunk.characters >= 40);
  if (!readable.length) return 0;
  const characters = readable.reduce((total, chunk) => total + chunk.characters, 0);
  const concepts = readable.reduce((total, chunk) => total + Math.min(20, chunk.conceptSignals), 0);
  const sections = new Set(readable.map((chunk) => chunk.sectionId)).size;
  // Conservative capacity estimate; it is a suggested bank size, never a quality guarantee.
  return Math.min(300, readable.length * 10, Math.max(5, Math.round(Math.min(characters / 1200, concepts * 2 + sections * 6))));
}

export function allocateQuizBlueprint(chunks: BlueprintChunk[], count: number, domain: StudyDomain = "general"): Array<{ formats: ResponseType[]; families: string[] }> {
  if (!chunks.length || count < 1) throw new Error("A readable PDF is required.");
  const result = chunks.map(() => ({ formats: [] as ResponseType[], families: [] as string[] }));
  const sectionOrder = [...new Set(chunks.filter((chunk) => chunk.characters > 0).map((chunk) => chunk.sectionId))];
  if (!sectionOrder.length) throw new Error("No readable PDF text was found. OCR is needed.");
  if (count > chunks.filter((chunk) => chunk.characters > 0).length * 10) {
    throw new Error("This PDF needs more distinct readable sections for that many reliable questions. Choose a smaller bank.");
  }
  const sectionWeight = sectionOrder.map((id) => chunks.reduce((sum, chunk) => chunk.sectionId === id
    ? sum + Math.sqrt(Math.max(1, chunk.characters)) * (1 + Math.min(0.5, chunk.conceptSignals / 10)) : sum, 0));
  const sectionSlots = sectionOrder.map(() => 0);
  const chunkSlots = chunks.map(() => 0);
  const formats = responseTargets(count);
  for (let slot = 0; slot < count; slot++) {
    let section = 0;
    if (slot < sectionOrder.length && count >= sectionOrder.length) section = slot;
    else for (let index = 1; index < sectionOrder.length; index++) {
      const hasSpace = chunks.some((chunk, chunkIndex) => chunk.sectionId === sectionOrder[index] && chunk.characters > 0 && chunkSlots[chunkIndex] < 10);
      const currentSpace = chunks.some((chunk, chunkIndex) => chunk.sectionId === sectionOrder[section] && chunk.characters > 0 && chunkSlots[chunkIndex] < 10);
      if (hasSpace && (!currentSpace || sectionWeight[index] / (sectionSlots[index] + 1) > sectionWeight[section] / (sectionSlots[section] + 1))) section = index;
    }
    if (!chunks.some((chunk, chunkIndex) => chunk.sectionId === sectionOrder[section] && chunk.characters > 0 && chunkSlots[chunkIndex] < 10)) {
      section = sectionOrder.findIndex((id) => chunks.some((chunk, chunkIndex) => chunk.sectionId === id && chunk.characters > 0 && chunkSlots[chunkIndex] < 10));
    }
    sectionSlots[section]++;
    const candidates = chunks.map((chunk, index) => chunk.sectionId === sectionOrder[section] && chunk.characters > 0 && chunkSlots[index] < 10 ? index : -1).filter((index) => index >= 0);
    let chosen = candidates[0];
    for (const index of candidates.slice(1)) {
      const value = Math.sqrt(Math.max(1, chunks[index].characters)) * (1 + Math.min(0.5, chunks[index].conceptSignals / 10)) / (chunkSlots[index] + 1);
      const current = Math.sqrt(Math.max(1, chunks[chosen].characters)) * (1 + Math.min(0.5, chunks[chosen].conceptSignals / 10)) / (chunkSlots[chosen] + 1);
      if (value > current) chosen = index;
    }
    chunkSlots[chosen]++;
    result[chosen].formats.push(formats[slot]);
    const families = domain === "general" ? QUESTION_FAMILIES.slice(0, 8) : CLINICAL_FAMILIES;
    result[chosen].families.push(families[slot % families.length]);
  }
  return result;
}
