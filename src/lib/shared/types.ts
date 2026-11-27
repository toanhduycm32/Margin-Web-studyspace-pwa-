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

export type LegacyQuizQuestion = {
  question: string;
  options: [string, string, string, string];
  answer: number;
  explanation: string;
  sourceExcerpt: string;
  startPage: number;
  endPage: number;
};

export type ResponseType = "single_best" | "select_all" | "select_n";
export type EvidenceMode = "pdf" | "research";
export type EvidenceReference = { title: string; year: string; url: string;
  kind?: "curated_guideline_note" | "research_abstract"; reviewedAt?: string };
export type QuizQuestionV2 = {
  id: string;
  responseType: ResponseType;
  selectionCount: number | null;
  questionFamily: string;
  cognitiveDemand: "remember" | "understand" | "apply" | "analyze";
  difficulty: "foundational" | "intermediate" | "advanced";
  question: string;
  options: string[];
  correctOptionIds: number[];
  explanation: string;
  optionExplanations: string[];
  sourceExcerpt: string;
  startPage: number;
  endPage: number;
  objectiveId?: string;
  shuffleOptions?: boolean;
};
export type QuizQuestion = LegacyQuizQuestion | QuizQuestionV2;

export type DocumentSection = {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
  source: "outline" | "heading" | "inferred";
  role?: "instruction" | "front_matter";
  objectives?: string[];
  headings?: string[];
};

export type LearningObjective = {
  id: string;
  concept: string;
  objective: string;
  sourceExcerpt: string;
  family: string;
  secondaryFamily?: string;
};
export type LearningPlan = { objectives: LearningObjective[]; limitations: string[] };
export type GenerationOperation = {
  schema: 1; id: string; subject: string; documentId: string; sourceMd5: string;
  kind: "summary" | "quiz"; startedAt: string;
};

export type ArtifactRecord = {
  schema: 1 | 2;
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
  ruleVersion?: string;
  summaryProfile?: string;
  sections?: DocumentSection[];
  assessedSectionIds?: string[];
  evidenceMode?: EvidenceMode;
  evidenceReferences?: EvidenceReference[];
  modelsUsed?: string[];
  generation?: { operationId: string; startedAt: string };
  learningObjectives?: LearningObjective[];
  assessedObjectiveIds?: string[];
  planningLimitations?: string[];
  payload: { text: string } | { questions: QuizQuestion[] };
};

export type AttemptRecord = {
  schema: 1 | 2;
  id: string;
  artifactId: string;
  documentId: string;
  createdAt: string;
  answers: number[] | number[][];
  score: number;
  questionCount: number;
};

export type MapRecord = {
  schema: 2 | 3;
  subject: string;
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
  ruleVersion?: string;
  summaryProfile?: string;
  section?: DocumentSection;
  wordTarget?: number;
  plannedFormats?: ResponseType[];
  plannedFamilies?: string[];
  digest?: string;
  questions?: QuizQuestion[];
  evidenceMode?: EvidenceMode;
  evidenceReferences?: EvidenceReference[];
  modelsUsed?: string[];
  operationId?: string;
  objectives?: LearningObjective[];
  planningLimitations?: string[];
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
export type ChunkProgress = { pending: true; completedQuestions: number; totalQuestions: number; stage?: string };
export type ChunkResult = SignedMap | ChunkProgress;
