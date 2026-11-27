import { createHash } from "node:crypto";
import type { ChunkResult, DocumentSection, EvidenceMode, MapRecord, ResponseType, SignedMap } from "@/lib/shared/types";
import { selectCoveredQuestions } from "@/lib/shared/quiz";
import { QUESTION_FAMILIES, STUDY_RULE_VERSION, classifyStudyDomain, responseTargets, summaryProfile, type SummaryProfile } from "@/lib/shared/study-rules";
import { retrieveEvidence } from "./evidence";
import { signMap, verifyMap } from "./crypto";
import { AppError } from "./errors";
import { summarizeChunk, generateChunkQuestions, modelName } from "./nvidia";
import { checkedPdf, getDocumentRecord, getMap, saveArtifact, saveMap } from "./store";
import { withAiAdmission } from "./ai-admission";

export type AiPrincipal = { sub: string; accessToken: string };

export type ChunkInput = {
  kind: "summary" | "quiz";
  operationId: string;
  documentId: string;
  sourceMd5: string;
  chunkIndex: number;
  chunkCount: number;
  startPage: number;
  endPage: number;
  pageCount: number;
  requestedCount: number;
  emptyPages: number[];
  text: string;
  section: DocumentSection;
  summaryProfile?: SummaryProfile;
  wordTarget?: number;
  plannedFormats?: ResponseType[];
  plannedFamilies?: string[];
  evidenceMode?: EvidenceMode;
};

function validQuizCount(value: number): boolean { return Number.isInteger(value) && value >= 5 && value <= 300; }
const operationPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validSection(section: DocumentSection | undefined, pageCount: number, startPage: number, endPage: number): boolean {
  return !!section && /^section-\d{1,3}$/.test(section.id) && typeof section.title === "string" &&
    section.title.length >= 3 && section.title.length <= 110 &&
    ["outline", "heading", "inferred"].includes(section.source) &&
    Number.isInteger(section.startPage) && Number.isInteger(section.endPage) && section.startPage >= 1 &&
    section.endPage <= pageCount && section.startPage <= startPage && section.endPage >= endPage;
}

function validChunk(input: ChunkInput): void {
  if (!input || !["summary", "quiz"].includes(input.kind) || !operationPattern.test(input.operationId || "") ||
      typeof input.documentId !== "string" || typeof input.sourceMd5 !== "string" ||
      !/^[a-f0-9]{32}$/i.test(input.sourceMd5) || typeof input.text !== "string" ||
      input.text.length > 50_000 || !Number.isInteger(input.chunkCount) || input.chunkCount < 1 || input.chunkCount > 80 ||
      !Number.isInteger(input.chunkIndex) || input.chunkIndex < 0 || input.chunkIndex >= input.chunkCount ||
      !Number.isInteger(input.pageCount) || input.pageCount < 1 || input.pageCount > 5000 ||
      !Number.isInteger(input.startPage) || !Number.isInteger(input.endPage) || input.startPage < 1 ||
      input.endPage < input.startPage || input.endPage > input.pageCount ||
      !validSection(input.section, input.pageCount, input.startPage, input.endPage) ||
      (input.evidenceMode !== undefined && !["pdf", "research"].includes(input.evidenceMode)) ||
      !Array.isArray(input.emptyPages) || input.emptyPages.some((page) => !Number.isInteger(page) || page < input.startPage || page > input.endPage) ||
      (input.kind === "summary" && (input.requestedCount !== 0 || !Number.isInteger(input.wordTarget) ||
        (input.wordTarget || 0) < 20 || (input.wordTarget || 0) > 1000)) ||
      (input.kind === "quiz" && (!validQuizCount(input.requestedCount) ||
        !Array.isArray(input.plannedFormats) || !Array.isArray(input.plannedFamilies) ||
        input.plannedFormats.length !== input.plannedFamilies.length || input.plannedFormats.length > 10 ||
        input.plannedFormats.some((type) => !["single_best", "select_all", "select_n"].includes(type)) ||
        input.plannedFamilies.some((family) => !QUESTION_FAMILIES.includes(family as typeof QUESTION_FAMILIES[number]))))) {
    throw new AppError(400, "Invalid whole-PDF processing segment.");
  }
  if (input.kind === "summary") {
    try { summaryProfile(input.summaryProfile); } catch { throw new AppError(400, "Choose a valid summary style."); }
  }
}

function mapIdentity(input: ChunkInput, textHash: string): string {
  return createHash("sha256").update(JSON.stringify({ operationId: input.operationId, textHash, rule: STUDY_RULE_VERSION, kind: input.kind,
    section: input.section, summaryProfile: input.summaryProfile, wordTarget: input.wordTarget,
    evidenceMode: input.evidenceMode || "pdf",
    plannedFormats: input.plannedFormats, plannedFamilies: input.plannedFamilies })).digest("hex").slice(0, 20);
}

export async function processChunk(principal: AiPrincipal, input: ChunkInput, signal?: AbortSignal): Promise<ChunkResult> {
  validChunk(input);
  const { accessToken, sub } = principal;
  await getDocumentRecord(accessToken, input.documentId);
  const file = await checkedPdf(accessToken, input.documentId);
  if (file.md5Checksum !== input.sourceMd5) throw new AppError(409, "PDF changed during processing. Reopen it and start again.");
  const textHash = createHash("sha256").update(input.text).digest("hex");
  const identity = mapIdentity(input, textHash);
  const name = `map-v3-${input.kind}-${input.documentId}-${input.sourceMd5}-${input.requestedCount}-${input.chunkIndex}-${identity}.json`;
  const previous = await getMap(accessToken, name);
  if (previous) {
    const map = previous.map;
    if (!verifyMap(map, previous.signature) || map.schema !== 3 || map.subject !== sub ||
        map.textHash !== textHash || map.ruleVersion !== STUDY_RULE_VERSION || map.kind !== input.kind ||
        map.documentId !== input.documentId || map.sourceMd5 !== input.sourceMd5 ||
        map.chunkIndex !== input.chunkIndex || map.chunkCount !== input.chunkCount ||
        map.startPage !== input.startPage || map.endPage !== input.endPage || map.pageCount !== input.pageCount ||
        map.requestedCount !== input.requestedCount || map.summaryProfile !== input.summaryProfile ||
        (map.evidenceMode || "pdf") !== (input.evidenceMode || "pdf") ||
        map.wordTarget !== input.wordTarget || JSON.stringify(map.section) !== JSON.stringify(input.section) ||
        JSON.stringify(map.plannedFormats || []) !== JSON.stringify(input.plannedFormats || []) ||
        JSON.stringify(map.plannedFamilies || []) !== JSON.stringify(input.plannedFamilies || []) ||
        JSON.stringify(map.emptyPages) !== JSON.stringify([...new Set(input.emptyPages)].sort((a, b) => a - b))) {
      throw new AppError(502, "Saved processing segment failed integrity validation.");
    }
    return previous;
  }
  const map: MapRecord = { schema: 3, subject: sub, kind: input.kind, documentId: input.documentId,
    sourceMd5: input.sourceMd5, chunkIndex: input.chunkIndex, chunkCount: input.chunkCount,
    startPage: input.startPage, endPage: input.endPage, pageCount: input.pageCount,
    requestedCount: input.requestedCount, textHash, emptyPages: [...new Set(input.emptyPages)].sort((a, b) => a - b),
    ruleVersion: STUDY_RULE_VERSION, summaryProfile: input.summaryProfile, section: input.section,
    wordTarget: input.wordTarget, plannedFormats: input.plannedFormats, plannedFamilies: input.plannedFamilies,
    evidenceMode: input.evidenceMode || "pdf" };
  const modelsUsed = new Set<string>();
  let evidencePromise: ReturnType<typeof retrieveEvidence> | undefined;
  const evidenceForGeneration = () => evidencePromise ||= input.evidenceMode === "research"
    ? retrieveEvidence(input.text, classifyStudyDomain(`${input.section.title} ${input.text}`)) : Promise.resolve([]);
  const references = new Map<string, NonNullable<MapRecord["evidenceReferences"]>[number]>();
  if (map.emptyPages.length === map.endPage - map.startPage + 1) {
    if (input.kind === "summary") map.digest = "No extractable text was available for these pages; visual content was not interpreted.";
    else map.questions = [];
  } else if (input.text.replace(/^Page \d+\n/gm, "").replace(/\[No extractable text\]/g, "").trim().length < 40) {
    if (input.kind === "summary") map.digest = `Only limited text could be extracted from these pages: ${input.text.replace(/^Page \d+\n/gm, "").replace(/\[No extractable text\]/g, "").trim()}. No further interpretation was generated.`;
    else if (input.plannedFormats!.length) throw new AppError(422, "This PDF section has too little text for reliable questions.");
    else map.questions = [];
  } else if (input.kind === "summary") {
    const evidence = await evidenceForGeneration();
    map.digest = await withAiAdmission(principal, (reserve) => summarizeChunk(input.text, input.startPage,
      input.endPage, input.summaryProfile!, input.section.title, input.section.source, input.wordTarget!, reserve, signal, evidence,
      (model) => modelsUsed.add(model)),
    { operationId: input.operationId, phase: "summary_segment" });
    for (const { title, year, url } of evidence) references.set(url, { title, year, url });
  } else if (input.plannedFormats!.length) {
    const result = await withAiAdmission(principal, async (reserve) => {
      const questions: NonNullable<MapRecord["questions"]> = [];
      let generatedBatches = 0;
      for (let offset = 0; offset < input.plannedFormats!.length; offset += 5) {
        if (signal?.aborted) throw new AppError(499, "Processing stopped. Retry to reuse completed work.");
        const formats = input.plannedFormats!.slice(offset, offset + 5);
        const families = input.plannedFamilies!.slice(offset, offset + 5);
        const batchName = name.replace(/\.json$/, `-batch-${offset}.json`);
        const saved = await getMap(accessToken, batchName);
        if (saved) {
          if (!verifyMap(saved.map, saved.signature) || saved.map.schema !== 3 || saved.map.subject !== sub ||
              saved.map.ruleVersion !== STUDY_RULE_VERSION || saved.map.textHash !== textHash ||
              saved.map.kind !== "quiz" || (saved.map.evidenceMode || "pdf") !== (input.evidenceMode || "pdf") ||
              saved.map.documentId !== input.documentId || saved.map.sourceMd5 !== input.sourceMd5 ||
              saved.map.startPage !== input.startPage || saved.map.endPage !== input.endPage ||
              JSON.stringify(saved.map.section) !== JSON.stringify(input.section) ||
              JSON.stringify(saved.map.plannedFormats) !== JSON.stringify(formats) ||
              JSON.stringify(saved.map.plannedFamilies) !== JSON.stringify(families) ||
              saved.map.questions?.length !== formats.length) {
            throw new AppError(502, "Saved assessment batch failed integrity validation.");
          }
          questions.push(...saved.map.questions!);
          for (const model of saved.map.modelsUsed || []) modelsUsed.add(model);
          for (const reference of saved.map.evidenceReferences || []) references.set(reference.url, reference);
          continue;
        }
        // A new HTTP request resumes from these signed Drive checkpoints. Never put
        // two full generation/review/repair workflows in one serverless invocation.
        if (generatedBatches >= 1) return { pending: true as const,
          completedQuestions: questions.length, totalQuestions: input.plannedFormats!.length };
        const evidence = await evidenceForGeneration();
        const batchModels = new Set<string>();
        const generated = await generateChunkQuestions(input.text, formats, families,
          input.startPage, input.endPage, input.section.title, reserve, signal, evidence,
          (model) => batchModels.add(model));
        const batchMap: MapRecord = { ...map, plannedFormats: formats, plannedFamilies: families, questions: generated,
          modelsUsed: [...batchModels], evidenceReferences: evidence.map(({ title, year, url }) => ({ title, year, url })) };
        await saveMap(accessToken, batchName, { map: batchMap, signature: signMap(batchMap) });
        for (const model of batchModels) modelsUsed.add(model);
        for (const reference of batchMap.evidenceReferences!) references.set(reference.url, reference);
        questions.push(...generated);
        generatedBatches++;
      }
      return questions.map((question, index) => ({ ...question, id: `${input.startPage}-${input.endPage}-${index + 1}` }));
    }, { operationId: input.operationId, phase: "quiz_segment" });
    if (!Array.isArray(result)) return result;
    map.questions = result;
  } else map.questions = [];
  if (signal?.aborted) throw new AppError(499, "Processing stopped. Retry to reuse completed work.");
  if (modelsUsed.size) map.modelsUsed = [...modelsUsed];
  if (references.size) map.evidenceReferences = [...references.values()];
  const signed = { map, signature: signMap(map) };
  await saveMap(accessToken, name, signed);
  return signed;
}

export type FinalizeInput = {
  kind: "summary" | "quiz";
  operationId: string;
  documentId: string;
  sourceMd5: string;
  requestedCount: number;
  summaryProfile?: SummaryProfile;
  evidenceMode?: EvidenceMode;
  maps: SignedMap[];
};

export async function finalize(principal: AiPrincipal, input: FinalizeInput) {
  const { accessToken, sub } = principal;
  if (!input || !["summary", "quiz"].includes(input.kind) || !operationPattern.test(input.operationId || "") ||
      typeof input.documentId !== "string" || typeof input.sourceMd5 !== "string" ||
      !/^[a-f0-9]{32}$/i.test(input.sourceMd5) || !Array.isArray(input.maps) ||
      input.maps.length < 1 || input.maps.length > 80 ||
      (input.evidenceMode !== undefined && !["pdf", "research"].includes(input.evidenceMode)) ||
      (input.kind === "summary" && input.requestedCount !== 0) ||
      (input.kind === "quiz" && !validQuizCount(input.requestedCount))) {
    throw new AppError(400, "Invalid whole-PDF completion request.");
  }
  if (input.kind === "summary") {
    try { summaryProfile(input.summaryProfile); } catch { throw new AppError(400, "Choose a valid summary style."); }
  }
  await getDocumentRecord(accessToken, input.documentId);
  const file = await checkedPdf(accessToken, input.documentId);
  if (file.md5Checksum !== input.sourceMd5) throw new AppError(409, "PDF changed during processing. Reopen it and start again.");
  const maps = input.maps.map((item) => {
    if (!item || !item.map || typeof item.signature !== "string" || !verifyMap(item.map, item.signature)) {
      throw new AppError(400, "Processing result failed integrity validation.");
    }
    return item.map;
  }).sort((a, b) => a.chunkIndex - b.chunkIndex);
  const pageCount = maps[0].pageCount;
  if (maps.length !== maps[0].chunkCount || maps[0].startPage !== 1 || maps.at(-1)!.endPage !== pageCount) {
    throw new AppError(400, "PDF processing is incomplete.");
  }
  for (let index = 0; index < maps.length; index++) {
    const map = maps[index];
    if (map.schema !== 3 || map.ruleVersion !== STUDY_RULE_VERSION || map.subject !== sub ||
        map.kind !== input.kind || map.documentId !== input.documentId || map.sourceMd5 !== input.sourceMd5 ||
        map.requestedCount !== input.requestedCount || map.summaryProfile !== input.summaryProfile ||
        (map.evidenceMode || "pdf") !== (input.evidenceMode || "pdf") ||
        map.chunkIndex !== index || map.chunkCount !== maps.length || map.pageCount !== pageCount ||
        (index > 0 && map.startPage !== maps[index - 1].endPage + 1) ||
        !validSection(map.section, pageCount, map.startPage, map.endPage) ||
        map.emptyPages.some((page) => page < map.startPage || page > map.endPage)) {
      throw new AppError(400, "PDF processing coverage is inconsistent.");
    }
  }
  const emptyPages = [...new Set(maps.flatMap((map) => map.emptyPages))].sort((a, b) => a - b);
  if (emptyPages.length === pageCount) throw new AppError(422, "No readable PDF text was found. OCR is needed.");
  const sections: DocumentSection[] = [];
  for (const map of maps) {
    if (!sections.some((item) => item.id === map.section!.id)) sections.push(map.section!);
  }
  for (let index = 0; index < sections.length; index++) {
    const section = sections[index];
    if (section.startPage !== (index ? sections[index - 1].endPage + 1 : 1) ||
        section.endPage !== (index === sections.length - 1 ? pageCount : sections[index + 1].startPage - 1)) {
      throw new AppError(400, "Document sections do not cover the full PDF.");
    }
  }
  const usedModels = [...new Set(maps.flatMap((map) => map.modelsUsed || []))];
  const common = { schema: 2 as const, documentId: input.documentId, sourceMd5: input.sourceMd5,
    model: usedModels.join(" + ") || modelName(), modelsUsed: usedModels,
    pageCount, readablePages: pageCount - emptyPages.length, emptyPages,
    chunkCount: maps.length, ruleVersion: STUDY_RULE_VERSION, sections,
    evidenceMode: input.evidenceMode || "pdf",
    evidenceReferences: [...new Map(maps.flatMap((map) => map.evidenceReferences || []).map((item) => [item.url, item])).values()] };
  if (input.kind === "summary") {
    if (maps.some((map) => !map.digest)) throw new AppError(400, "Section summary is missing.");
    const paragraphs = sections.map((section) => {
      const content = maps.filter((map) => map.section!.id === section.id).map((map) => map.digest!.trim()).join("\n\n");
      return `## ${section.title} · pages ${section.startPage}–${section.endPage}\n\n${content}`;
    });
    const note = emptyPages.length ? `\n\nText extraction found no readable text on ${emptyPages.length} page(s): ${emptyPages.join(", ")}. Scans, diagrams and other visual material were not interpreted.` : "";
    const text = `${paragraphs.join("\n\n")}\n\n${note}`.trim();
    return saveArtifact(accessToken, { ...common, kind: "summary", summaryProfile: input.summaryProfile,
      payload: { text } }, input.operationId);
  }
  const questions = selectCoveredQuestions(maps, input.requestedCount);
  if (questions.length !== input.requestedCount) throw new AppError(502, "Assessment is incomplete. Retry to reuse completed work.");
  const expected = responseTargets(input.requestedCount);
  for (const format of ["single_best", "select_all", "select_n"] as const) {
    if (questions.filter((question) => "responseType" in question && question.responseType === format).length !==
        expected.filter((item) => item === format).length) {
      throw new AppError(400, "Assessment response-format blueprint is inconsistent.");
    }
  }
  const assessedSectionIds = [...new Set(maps.filter((map) => (map.questions || []).length > 0).map((map) => map.section!.id))];
  return saveArtifact(accessToken, { ...common, kind: "quiz", assessedSectionIds, payload: { questions } }, input.operationId);
}
