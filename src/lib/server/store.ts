import { createHash, randomUUID } from "node:crypto";
import type { AppDataMeta } from "./google";
import { createAppData, deleteAppData, driveFile, findAppData, listAppData, readAppData, updateAppData } from "./google";
import { AppError } from "./errors";
import type { ArtifactRecord, AttemptRecord, DocumentRecord, DriveFile, GenerationOperation, LibraryItem, SignedMap } from "@/lib/shared/types";

const PDF_MIME = "application/pdf";
const MAX_PDF_SIZE = 250 * 1024 * 1024;

export function validSourceId(id: string): boolean { return /^[A-Za-z0-9_-]{8,160}$/.test(id); }
export function documentName(sourceId: string): string { return `document-${sourceId}.json`; }

function documentItem(meta: AppDataMeta): LibraryItem {
  return { sourceId: meta.appProperties?.documentId || "", name: meta.description || "Untitled PDF",
    recordId: meta.id, importedAt: meta.appProperties?.importedAt || meta.modifiedTime };
}

export async function listLibrary(accessToken: string, pageToken?: string) {
  const result = await listAppData(accessToken, { kind: "document", pageSize: 100, pageToken, orderBy: "modifiedTime desc" });
  return { documents: (result.files || []).map(documentItem).filter((item) => validSourceId(item.sourceId)),
    nextPageToken: result.nextPageToken || null };
}

export async function getDocumentRecord(accessToken: string, sourceId: string): Promise<{ record: DocumentRecord; meta: AppDataMeta }> {
  if (!validSourceId(sourceId)) throw new AppError(400, "Invalid document ID.");
  const meta = await findAppData(accessToken, documentName(sourceId));
  if (!meta || meta.appProperties?.kind !== "document" || meta.appProperties.documentId !== sourceId) {
    throw new AppError(404, "PDF is not in your library.");
  }
  const record = await readAppData<DocumentRecord>(accessToken, meta.id);
  if (record?.schema !== 1 || record.sourceId !== sourceId) throw new AppError(502, "Library record is damaged.");
  return { record, meta };
}

export async function checkedPdf(accessToken: string, sourceId: string): Promise<DriveFile> {
  const file = await driveFile(accessToken, sourceId);
  const size = Number(file.size);
  if (file.mimeType !== PDF_MIME || file.capabilities?.canDownload === false) {
    throw new AppError(415, "Only downloadable PDF files can be opened.");
  }
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_PDF_SIZE) {
    throw new AppError(413, "PDF must be between 1 byte and 250 MB.");
  }
  if (!file.md5Checksum || !/^[a-f0-9]{32}$/i.test(file.md5Checksum)) {
    throw new AppError(415, "Google Drive did not provide a stable checksum for this PDF.");
  }
  return file;
}

export async function importPdf(accessToken: string, sourceId: string) {
  if (!validSourceId(sourceId)) throw new AppError(400, "Invalid Drive file ID.");
  const file = await checkedPdf(accessToken, sourceId);
  const existing = await findAppData(accessToken, documentName(sourceId));
  if (existing) {
    const { record } = await getDocumentRecord(accessToken, sourceId);
    return { item: documentItem(existing), record, file, alreadyImported: true };
  }
  const now = new Date().toISOString();
  const record: DocumentRecord = { schema: 1, sourceId, name: file.name.slice(0, 200), importedAt: now,
    importedMd5: file.md5Checksum!, progress: { page: 1, offset: 0, updatedAt: now } };
  const meta = await createAppData(accessToken, documentName(sourceId), record,
    { kind: "document", documentId: sourceId, importedAt: now }, record.name);
  return { item: documentItem(meta), record, file, alreadyImported: false };
}

export async function setProgress(accessToken: string, sourceId: string, page: number, offset: number): Promise<void> {
  const { record, meta } = await getDocumentRecord(accessToken, sourceId);
  if (!Number.isInteger(page) || page < 1 || page > 20_000 || !Number.isFinite(offset) || offset < 0 || offset > 1) {
    throw new AppError(400, "Invalid reading position.");
  }
  await updateAppData(accessToken, meta.id, { ...record,
    progress: { page, offset, updatedAt: new Date().toISOString() } } satisfies DocumentRecord);
}

export async function getMap(accessToken: string, name: string): Promise<SignedMap | null> {
  const meta = await findAppData(accessToken, name);
  if (!meta) return null;
  if (meta.appProperties?.kind !== "map") throw new AppError(502, "Processing record has an invalid type.");
  return readAppData<SignedMap>(accessToken, meta.id);
}

export async function saveMap(accessToken: string, name: string, signed: SignedMap): Promise<void> {
  await createAppData(accessToken, name, signed,
    { kind: "map", documentId: signed.map.documentId, sourceMd5: signed.map.sourceMd5 });
}

export async function saveArtifact(accessToken: string, artifact: Omit<ArtifactRecord, "id" | "createdAt">,
  operationId?: string): Promise<ArtifactRecord> {
  const hash = operationId ? createHash("sha256").update(operationId).digest("hex") : null;
  const id = hash ? `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}` : randomUUID();
  const name = `artifact-${id}.json`;
  if (operationId) {
    const existing = await findAppData(accessToken, name);
    if (existing) {
      const saved = await readAppData<ArtifactRecord>(accessToken, existing.id);
      if (saved.id !== id || saved.documentId !== artifact.documentId || saved.sourceMd5 !== artifact.sourceMd5 ||
          saved.kind !== artifact.kind || saved.ruleVersion !== artifact.ruleVersion ||
          saved.summaryProfile !== artifact.summaryProfile ||
          (saved.kind === "quiz" && "questions" in saved.payload && "questions" in artifact.payload &&
            saved.payload.questions.length !== artifact.payload.questions.length)) {
        throw new AppError(409, "This operation ID belongs to a different learning resource.");
      }
      if (artifact.generation) await retireSuperseded(accessToken, saved);
      return saved;
    }
  }
  const full: ArtifactRecord = { ...artifact, id, createdAt: new Date().toISOString() };
  await createAppData(accessToken, name, full,
    { kind: "artifact", documentId: full.documentId, artifactId: full.id, artifactKind: full.kind,
      sourceMd5: full.sourceMd5, ...(full.generation ? { generationStart: full.generation.startedAt, operationId: full.generation.operationId } : {}) }, `${full.kind === "summary" ? "Tóm tắt" : "Trắc nghiệm"} · ${full.createdAt}`);
  if (full.generation) await retireSuperseded(accessToken, full);
  return full;
}

async function artifactFiles(accessToken: string, documentId: string) {
  if (!validSourceId(documentId)) throw new AppError(400, "Invalid document ID.");
  const files: AppDataMeta[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page++) {
    const result = await listAppData(accessToken, { kind: "artifact", documentId, pageSize: 100,
      orderBy: "createdTime desc", pageToken });
    files.push(...result.files || []);
    pageToken = result.nextPageToken;
    if (!pageToken) break;
  }
  if (pageToken) throw new AppError(503, "Thư viện học liệu quá lớn để đối soát an toàn. Chưa thay đổi bản hiện hành.");
  return files;
}

export function artifactOrder(meta: AppDataMeta): string {
  return `${meta.appProperties?.generationStart || meta.createdTime || meta.modifiedTime || ""}|${meta.appProperties?.operationId || meta.appProperties?.artifactId || meta.id}`;
}

export async function listArtifacts(accessToken: string, documentId: string) {
  const files = await artifactFiles(accessToken, documentId);
  const winners = new Map<string, AppDataMeta>();
  for (const meta of files) {
    const kind = meta.appProperties?.artifactKind || "";
    if (!["summary", "quiz"].includes(kind) || !/^[0-9a-f-]{36}$/i.test(meta.appProperties?.artifactId || "")) continue;
    const old = winners.get(kind);
    if (!old || artifactOrder(meta) > artifactOrder(old)) winners.set(kind, meta);
  }
  return [...winners.values()].map((meta) => ({ id: meta.appProperties?.artifactId || "", kind: meta.appProperties?.artifactKind || "",
    sourceMd5: meta.appProperties?.sourceMd5 || "", createdAt: meta.modifiedTime || "", recordId: meta.id }))
    .filter((item) => /^[0-9a-f-]{36}$/i.test(item.id));
}

// Publication is the successful creation of an immutable accepted artifact. Reads
// choose the greatest server-issued operation order, never the last response to finish.
// There is no read/modify/write current pointer and no claim of a Drive transaction.
async function retireSuperseded(accessToken: string, accepted: ArtifactRecord): Promise<void> {
  let files: AppDataMeta[];
  try { files = await artifactFiles(accessToken, accepted.documentId); }
  catch { console.warn("artifact_cleanup_deferred", { kind: accepted.kind }); return; }
  const rank = `${accepted.generation!.startedAt}|${accepted.generation!.operationId}`;
  const newer = files.find((meta) => meta.appProperties?.artifactKind === accepted.kind && artifactOrder(meta) > rank);
  if (newer) {
    // A delayed older operation must not resurrect a resource or remove the winner.
    for (const meta of files.filter((file) => file.appProperties?.artifactId === accepted.id)) {
      try { await deleteAppData(accessToken, meta); } catch { /* Reads still select the newer accepted operation. */ }
    }
    throw new AppError(409, "Một lần tạo mới hơn đã hoàn tất trên thiết bị khác. Mở học liệu hiện hành để tiếp tục.", "GENERATION_SUPERSEDED");
  }
  for (const meta of files) {
    if (meta.appProperties?.documentId !== accepted.documentId || meta.appProperties?.artifactKind !== accepted.kind ||
        meta.appProperties?.artifactId === accepted.id || artifactOrder(meta) >= rank) continue;
    try {
      // Delete dependent attempts only for exactly the superseded quiz identity.
      if (accepted.kind === "quiz") {
        let pageToken: string | undefined;
        const obsoleteAttempts: AppDataMeta[] = [];
        do {
          const attempts = await listAppData(accessToken, { kind: "attempt", documentId: accepted.documentId,
            artifactId: meta.appProperties.artifactId, pageSize: 100, pageToken });
          for (const attempt of attempts.files || []) {
            if (attempt.appProperties?.artifactId === meta.appProperties.artifactId &&
                attempt.appProperties?.documentId === accepted.documentId) obsoleteAttempts.push(attempt);
          }
          pageToken = attempts.nextPageToken;
        } while (pageToken);
        for (const attempt of obsoleteAttempts) await deleteAppData(accessToken, attempt);
      }
      await deleteAppData(accessToken, meta);
    } catch { console.warn("artifact_cleanup_deferred", { kind: accepted.kind }); }
  }
}

export async function beginGeneration(subject: string, accessToken: string,
  input: Pick<GenerationOperation, "id" | "documentId" | "sourceMd5" | "kind">): Promise<GenerationOperation> {
  if (!input || !/^[0-9a-f-]{36}$/i.test(input.id) || !["summary", "quiz"].includes(input.kind)) throw new AppError(400, "Yêu cầu tạo học liệu không hợp lệ.");
  await getDocumentRecord(accessToken, input.documentId);
  const file = await checkedPdf(accessToken, input.documentId);
  if (file.md5Checksum !== input.sourceMd5) throw new AppError(409, "PDF đã thay đổi. Mở lại tài liệu trước khi tạo học liệu.");
  let meta = await findAppData(accessToken, `generation-${input.id}.json`);
  if (!meta) {
    const record: GenerationOperation = { schema: 1, ...input, subject, startedAt: new Date().toISOString() };
    meta = await createAppData(accessToken, `generation-${input.id}.json`, record,
      { kind: "generation", documentId: input.documentId, sourceMd5: input.sourceMd5, operationId: input.id });
  }
  return generationOperation(subject, accessToken, input, meta);
}

export async function generationOperation(subject: string, accessToken: string,
  input: Pick<GenerationOperation, "id" | "documentId" | "sourceMd5" | "kind">, known?: AppDataMeta): Promise<GenerationOperation> {
  const meta = known || await findAppData(accessToken, `generation-${input.id}.json`);
  if (!meta || meta.appProperties?.kind !== "generation") throw new AppError(409, "Phiên tạo học liệu chưa được khởi tạo. Tải lại trang và thử lại.");
  const operation = await readAppData<GenerationOperation>(accessToken, meta.id);
  if (operation.subject !== subject || operation.id !== input.id || operation.documentId !== input.documentId ||
      operation.sourceMd5 !== input.sourceMd5 || operation.kind !== input.kind || !meta.createdTime) {
    throw new AppError(409, "Phiên tạo học liệu không khớp tài khoản hoặc tài liệu.");
  }
  return { ...operation, startedAt: meta.createdTime };
}

export async function getArtifact(accessToken: string, artifactId: string): Promise<ArtifactRecord> {
  if (!/^[0-9a-f-]{36}$/i.test(artifactId)) throw new AppError(400, "Invalid resource ID.");
  const meta = await findAppData(accessToken, `artifact-${artifactId}.json`);
  if (!meta || meta.appProperties?.kind !== "artifact") throw new AppError(404, "Learning resource not found.");
  const artifact = await readAppData<ArtifactRecord>(accessToken, meta.id);
  if (![1, 2].includes(artifact.schema) || artifact.id !== artifactId) throw new AppError(502, "Learning resource is damaged.");
  return artifact;
}

export async function saveAttempt(accessToken: string, attempt: Omit<AttemptRecord, "id" | "createdAt">): Promise<AttemptRecord> {
  const assertCurrent = async () => {
    const current = (await listArtifacts(accessToken, attempt.documentId)).find((item) => item.kind === "quiz");
    if (!current || current.id !== attempt.artifactId) throw new AppError(409, "Bộ câu hỏi này đã được thay thế. Mở bộ hiện hành để làm bài mới.");
  };
  await assertCurrent();
  const full: AttemptRecord = { ...attempt, id: randomUUID(), createdAt: new Date().toISOString() };
  const meta = await createAppData(accessToken, `attempt-${full.id}.json`, full,
    { kind: "attempt", documentId: full.documentId, artifactId: full.artifactId }, "Quiz attempt");
  try { await assertCurrent(); }
  catch (error) {
    // Close the common replacement-during-submit race. Never delete another attempt.
    if (error instanceof AppError && error.status === 409) {
      try { await deleteAppData(accessToken, meta); } catch { console.warn("attempt_cleanup_deferred"); }
      throw error;
    }
    // A successfully saved attempt is still saved when a reconciliation read fails.
  }
  return full;
}

export async function listAttempts(accessToken: string, artifactId: string): Promise<AttemptRecord[]> {
  if (!/^[0-9a-f-]{36}$/i.test(artifactId)) throw new AppError(400, "Invalid resource ID.");
  const result = await listAppData(accessToken, { kind: "attempt", artifactId, pageSize: 10, orderBy: "createdTime desc" });
  const records = await Promise.all((result.files || []).map((meta) => readAppData<AttemptRecord>(accessToken, meta.id)));
  return records.filter((item) => [1, 2].includes(item.schema) && item.artifactId === artifactId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
