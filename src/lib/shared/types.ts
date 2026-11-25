export type DocumentRecord = {
  schema: 1;
  sourceId: string;
  name: string;
  importedAt: string;
  importedMd5: string;
  progress: { page: number; offset: number; updatedAt: string };
};

export type LibraryItem = {
  sourceId: string;
  name: string;
  recordId: string;
  importedAt?: string;
};

export type QuizQuestion = {
  question: string;
  options: [string, string, string, string];
  answer: number;
  explanation: string;
  sourceExcerpt: string;
  startPage: number;
  endPage: number;
};

export type ArtifactRecord = {
  schema: 1;
  id: string;
  documentId: string;
  sourceMd5: string;
  kind: "summary" | "quiz";
  createdAt: string;
  model: string;
  pageCount: number;
  readablePages: number;
  emptyPages: number[];
  chunkCount: number;
  payload: { text: string } | { questions: QuizQuestion[] };
};

export type AttemptRecord = {
  schema: 1;
  id: string;
  artifactId: string;
  documentId: string;
  createdAt: string;
  answers: number[];
  score: number;
  questionCount: number;
};

export type MapRecord = {
  schema: 1;
  kind: "summary" | "quiz";
  documentId: string;
  sourceMd5: string;
  chunkIndex: number;
  chunkCount: number;
  startPage: number;
  endPage: number;
  pageCount: number;
  requestedCount: number;
  textHash: string;
  emptyPages: number[];
  digest?: string;
  questions?: QuizQuestion[];
};

export type SignedMap = { map: MapRecord; signature: string };

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  md5Checksum?: string;
  version?: string;
  modifiedTime?: string;
  capabilities?: { canDownload?: boolean };
};
