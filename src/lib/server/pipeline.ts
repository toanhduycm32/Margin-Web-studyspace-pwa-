import { createHash } from "node:crypto";
import type { MapRecord, SignedMap } from "@/lib/shared/types";
import { selectCoveredQuestions } from "@/lib/shared/quiz";
import { signMap, verifyMap } from "./crypto";
import { AppError } from "./errors";
import { summarizeChunk, generateChunkQuestions, synthesizeSummary, modelName } from "./nvidia";
import { checkedPdf, getDocumentRecord, getMap, saveArtifact, saveMap } from "./store";

export type ChunkInput = {
  kind: "summary" | "quiz";
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
};

const quizCounts = new Set([5, 10, 20, 30]);

function validChunk(input: ChunkInput): void {
  if (!input || !["summary", "quiz"].includes(input.kind) ||
      typeof input.documentId !== "string" || typeof input.sourceMd5 !== "string" ||
      !/^[a-f0-9]{32}$/i.test(input.sourceMd5) || typeof input.text !== "string" ||
      input.text.length > 50_000 || !Number.isInteger(input.chunkCount) || input.chunkCount < 1 || input.chunkCount > 80 ||
      !Number.isInteger(input.chunkIndex) || input.chunkIndex < 0 || input.chunkIndex >= input.chunkCount ||
      !Number.isInteger(input.pageCount) || input.pageCount < 1 || input.pageCount > 5000 ||
      !Number.isInteger(input.startPage) || !Number.isInteger(input.endPage) || input.startPage < 1 ||
      input.endPage < input.startPage || input.endPage > input.pageCount ||
      !Array.isArray(input.emptyPages) || input.emptyPages.some((page) => !Number.isInteger(page) || page < input.startPage || page > input.endPage) ||
      (input.kind === "summary" && input.requestedCount !== 0) ||
      (input.kind === "quiz" && !quizCounts.has(input.requestedCount))) {
    throw new AppError(400, "Invalid whole-PDF processing chunk.");
  }
}

export async function processChunk(accessToken: string, input: ChunkInput): Promise<SignedMap> {
  validChunk(input);
  await getDocumentRecord(accessToken, input.documentId);
  const file = await checkedPdf(accessToken, input.documentId);
  if (file.md5Checksum !== input.sourceMd5) throw new AppError(409, "PDF changed during processing. Reopen it and start again.");
  const textHash = createHash("sha256").update(input.text).digest("hex");
  const name = `map-${input.kind}-${input.documentId}-${input.sourceMd5}-${input.requestedCount}-${input.chunkIndex}-${textHash.slice(0, 16)}.json`;
  const previous = await getMap(accessToken, name);
  if (previous) {
    if (!verifyMap(previous.map, previous.signature) || previous.map.textHash !== textHash ||
        previous.map.kind !== input.kind || previous.map.documentId !== input.documentId ||
        previous.map.sourceMd5 !== input.sourceMd5 || previous.map.chunkIndex !== input.chunkIndex ||
        previous.map.chunkCount !== input.chunkCount || previous.map.startPage !== input.startPage ||
        previous.map.endPage !== input.endPage || previous.map.pageCount !== input.pageCount ||
        previous.map.requestedCount !== input.requestedCount ||
        JSON.stringify(previous.map.emptyPages) !== JSON.stringify([...new Set(input.emptyPages)].sort((a, b) => a - b))) {
      throw new AppError(502, "Saved processing chunk failed integrity validation.");
    }
    return previous;
  }
  const map: MapRecord = { schema: 1, kind: input.kind, documentId: input.documentId,
    sourceMd5: input.sourceMd5, chunkIndex: input.chunkIndex, chunkCount: input.chunkCount,
    startPage: input.startPage, endPage: input.endPage, pageCount: input.pageCount,
    requestedCount: input.requestedCount, textHash, emptyPages: [...new Set(input.emptyPages)].sort((a, b) => a - b) };
  if (map.emptyPages.length === map.endPage - map.startPage + 1 || input.text.trim().length < 40) {
    if (map.emptyPages.length !== map.endPage - map.startPage + 1) {
      throw new AppError(422, "This PDF section has too little extractable text.");
    }
    if (input.kind === "summary") map.digest = "These pages contain no extractable text. Their visual content was not interpreted.";
    else map.questions = [];
  } else if (input.kind === "summary") {
    map.digest = await summarizeChunk(input.text, input.startPage, input.endPage);
  } else {
    const candidates = Math.min(30, Math.max(2, Math.ceil(input.requestedCount / input.chunkCount) + 1));
    map.questions = await generateChunkQuestions(input.text, candidates, input.startPage, input.endPage);
  }
  const signed = { map, signature: signMap(map) };
  await saveMap(accessToken, name, signed);
  return signed;
}

export type FinalizeInput = {
  kind: "summary" | "quiz";
  documentId: string;
  sourceMd5: string;
  requestedCount: number;
  maps: SignedMap[];
};

export async function finalize(accessToken: string, input: FinalizeInput) {
  if (!input || !["summary", "quiz"].includes(input.kind) || typeof input.documentId !== "string" ||
      typeof input.sourceMd5 !== "string" || !/^[a-f0-9]{32}$/i.test(input.sourceMd5) ||
      !Array.isArray(input.maps) || input.maps.length < 1 || input.maps.length > 80 ||
      (input.kind === "summary" && input.requestedCount !== 0) ||
      (input.kind === "quiz" && !quizCounts.has(input.requestedCount))) {
    throw new AppError(400, "Invalid whole-PDF completion request.");
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
  if (maps.length !== maps[0].chunkCount || maps[0].startPage !== 1 || maps[maps.length - 1].endPage !== pageCount) {
    throw new AppError(400, "PDF processing is incomplete.");
  }
  for (let index = 0; index < maps.length; index++) {
    const map = maps[index];
    if (map.schema !== 1 || map.kind !== input.kind || map.documentId !== input.documentId ||
        map.sourceMd5 !== input.sourceMd5 || map.requestedCount !== input.requestedCount ||
        map.chunkIndex !== index || map.chunkCount !== maps.length || map.pageCount !== pageCount ||
        (index > 0 && map.startPage !== maps[index - 1].endPage + 1) ||
        map.emptyPages.some((page) => page < map.startPage || page > map.endPage)) {
      throw new AppError(400, "PDF processing coverage is inconsistent.");
    }
  }
  const emptyPages = [...new Set(maps.flatMap((map) => map.emptyPages))].sort((a, b) => a - b);
  if (emptyPages.length === pageCount) throw new AppError(422, "No readable PDF text was found. OCR is needed.");
  const common = { schema: 1 as const, documentId: input.documentId, sourceMd5: input.sourceMd5,
    model: modelName(), pageCount, readablePages: pageCount - emptyPages.length,
    emptyPages, chunkCount: maps.length };
  if (input.kind === "summary") {
    if (maps.some((map) => !map.digest)) throw new AppError(400, "Summary digest is missing.");
    const text = await synthesizeSummary(maps.map((map) => ({ startPage: map.startPage,
      endPage: map.endPage, digest: map.digest! })), pageCount, emptyPages);
    return saveArtifact(accessToken, { ...common, kind: "summary", payload: { text } });
  }
  const questions = selectCoveredQuestions(maps, input.requestedCount);
  return saveArtifact(accessToken, { ...common, kind: "quiz", payload: { questions } });
}
