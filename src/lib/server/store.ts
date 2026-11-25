import { createHash, randomUUID } from "node:crypto";
import type { AppDataMeta } from "./google";
import { createAppData, driveFile, findAppData, listAppData, readAppData, updateAppData } from "./google";
import { AppError } from "./errors";
import type { ArtifactRecord, AttemptRecord, DocumentRecord, DriveFile, LibraryItem, SignedMap } from "@/lib/shared/types";

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
      return saved;
    }
  }
  const full: ArtifactRecord = { ...artifact, id, createdAt: new Date().toISOString() };
  await createAppData(accessToken, name, full,
    { kind: "artifact", documentId: full.documentId, artifactId: full.id, artifactKind: full.kind,
      sourceMd5: full.sourceMd5 }, `${full.kind === "summary" ? "Summary" : "Quiz"} · ${full.createdAt}`);
  return full;
}

export async function listArtifacts(accessToken: string, documentId: string) {
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
  return files.map((meta) => ({ id: meta.appProperties?.artifactId || "", kind: meta.appProperties?.artifactKind || "",
    sourceMd5: meta.appProperties?.sourceMd5 || "", createdAt: meta.modifiedTime || "", recordId: meta.id }))
    .filter((item) => /^[0-9a-f-]{36}$/i.test(item.id));
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
  const full: AttemptRecord = { ...attempt, id: randomUUID(), createdAt: new Date().toISOString() };
  await createAppData(accessToken, `attempt-${full.id}.json`, full,
    { kind: "attempt", documentId: full.documentId, artifactId: full.artifactId }, "Quiz attempt");
  return full;
}

export async function listAttempts(accessToken: string, artifactId: string): Promise<AttemptRecord[]> {
  if (!/^[0-9a-f-]{36}$/i.test(artifactId)) throw new AppError(400, "Invalid resource ID.");
  const result = await listAppData(accessToken, { kind: "attempt", artifactId, pageSize: 10, orderBy: "createdTime desc" });
  const records = await Promise.all((result.files || []).map((meta) => readAppData<AttemptRecord>(accessToken, meta.id)));
  return records.filter((item) => [1, 2].includes(item.schema) && item.artifactId === artifactId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
