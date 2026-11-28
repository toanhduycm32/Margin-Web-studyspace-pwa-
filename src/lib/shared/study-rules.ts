import { canonicalSummaryTarget, VIETNAMESE_STANDARD } from "./education";
import type { ResponseType } from "./types";

export const STUDY_RULE_VERSION = "2026-11-28-source-selection-2";

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

// Legacy profile names remain accepted only for stored-job compatibility. The UI and
// every current operation select this one canonical educational standard.
export const SUMMARY_PROFILES = {
  medical: { label: "Học tập Y khoa · Răng Hàm Mặt", purpose: "Hiểu và ôn tập đầy đủ tài liệu", minWords: 200, baseWords: 320, maxWords: 1600 },
} as const;
export type SummaryProfile = "medical" | "concise" | "academic" | "deep" | "revision" | "clinical";
export function summaryProfile(value: unknown): SummaryProfile {
  if (!["medical", "concise", "academic", "deep", "revision", "clinical"].includes(String(value))) throw new Error("Thiết lập tóm tắt không hợp lệ.");
  return value as SummaryProfile;
}
export function sectionWordTarget(_profile: SummaryProfile, characters: number): number {
  return canonicalSummaryTarget(characters);
}
export function summaryInstruction(_profile: SummaryProfile): string {
  return `${VIETNAMESE_STANDARD} Tạo học liệu có cấu trúc theo bài và các đề mục thật, giữ định nghĩa, cơ chế, phân loại, quan hệ, điều kiện và ngoại lệ. Đoạn văn giải thích là chính; bảng/danh sách chỉ khi giúp so sánh hoặc biểu diễn trình tự. Bỏ lời giới thiệu hành chính, mục lục lặp và câu tự lượng giá. Không tự thêm kiến thức ngoài nguồn. Đề mục suy luận phải ghi rõ. Độ dài đo bằng đơn vị tách bởi khoảng trắng; mục lớn thông thường khoảng 200–400 đơn vị, phần phức tạp 400–800 hoặc hơn theo nguồn. Không thêm lời để đủ số lượng và không cắt điều kiện y khoa để rút ngắn.`;
}
export const QUESTION_FAMILIES = ["definition", "mechanism", "application", "comparison",
  "assumption", "error_analysis", "boundary_condition", "cross_concept",
  "clinical_presentation", "diagnostic_reasoning", "investigation", "management",
  "contraindication", "integrated_case", "anatomical_relation", "etiology", "classification",
  "complication", "material_property", "prevention", "pharmacology"] as const;

export const CLINICAL_FAMILIES = ["mechanism", "clinical_presentation", "diagnostic_reasoning",
  "investigation", "management", "contraindication", "integrated_case"] as const;

export const QUESTION_FAMILY_RULES: Record<typeof QUESTION_FAMILIES[number], string> = {
  anatomical_relation: "Phân biệt vị trí, mặt, hướng, liên quan và chức năng cấu trúc. Nhiễu đảo quan hệ gần/xa, thân/chân, răng sữa/vĩnh viễn phải sai theo đúng điều kiện; không suy hình từ chú thích.",
  etiology: "Phân biệt nguyên nhân, yếu tố nguy cơ và cơ chế. Không biến sự kết hợp thành nhân quả. Nhiễu nhầm vai trò hoặc bỏ điều kiện, không bịa căn nguyên mới.",
  classification: "Áp dụng tiêu chí phân loại của đúng phiên bản nguồn; nêu đủ tiêu chí phân biệt. Không trộn hai hệ thống hoặc lấy ngưỡng ngoài PDF.",
  complication: "Nối diễn biến bệnh với hậu quả hoặc biến chứng theo nguồn; phân biệt triệu chứng hiện tại, nguy cơ và biến chứng đã xảy ra. Giữ trình tự và điều kiện.",
  material_property: "Liên hệ thành phần, cấu trúc, tính chất, thao tác và ứng dụng vật liệu. Nhiễu phải dùng sai một quan hệ, không đánh đồng độ bền cơ học với hiệu quả lâm sàng.",
  prevention: "Phân biệt đối tượng, nguy cơ, biện pháp, mức dự phòng và kết cục. Giữ điều kiện triển khai; không coi một biện pháp đúng cho mọi đối tượng.",
  pharmacology: "Phân biệt cơ chế, chỉ định, chống chỉ định, tác dụng bất lợi và tương tác có trong nguồn. Không tạo liều, thời gian dùng hoặc đơn thuốc ngoài PDF.",
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

export const ASSESSMENT_ITEM_RULES = `Độ khó: remember = nhận diện một dữ kiện; understand = giải thích/phân biệt một quan hệ; apply = áp dụng một quy tắc có điều kiện; analyze = kết hợp từ hai quan hệ được hỗ trợ. Không nâng độ khó bằng câu chữ rối, số liệu không cần thiết hay ngoại lệ ngoài nguồn.
Khóa đáp án: kiểm tra từng lựa chọn dưới cùng điều kiện; một nhận định đúng nhưng ít liên quan không được gán sai. Nhiễu: đảo quan hệ, nhầm cơ chế, thiếu điều kiện, dùng nhầm tiêu chí hoặc lẫn nguyên nhân với hậu quả; phải có cơ sở giải thích rõ vì sao sai.
Loại câu nếu thiếu dữ kiện phân biệt, có nhiều đáp án hợp lý ngoài khóa, lặp một mục tiêu bằng thay tên, hoặc cần kiến thức ngoài PDF. Giải thích phải nêu quan hệ được kiểm tra, áp dụng chứng cứ và sửa ngộ nhận của từng lựa chọn; không chỉ nhắc lại chữ đúng/sai.`;

export function familyConstruction(family: string, includeCommon = true): string {
  const clinical = ["clinical_presentation", "diagnostic_reasoning", "investigation", "management", "contraindication", "integrated_case", "pharmacology", "complication"].includes(family);
  const relational = ["mechanism", "anatomical_relation", "cross_concept", "etiology", "material_property"].includes(family);
  return `${QUESTION_FAMILY_RULES[family as keyof typeof QUESTION_FAMILY_RULES]}
Chứng cứ cần có: ${clinical ? "đối tượng, tình huống, phát hiện phân biệt và điều kiện có thể làm đổi quyết định; thiếu điều kiện quyết định thì đổi mục tiêu, không tự thêm" : relational ? "ít nhất hai thành phần và quan hệ có hướng giữa chúng, không chỉ cùng xuất hiện trong một đoạn" : "định nghĩa hoặc tiêu chí rõ, kèm trường hợp áp dụng hoặc giới hạn của nguồn"}.
Cách dựng câu: ${clinical ? "ca ngắn chỉ giữ dữ kiện cần thiết; nêu rõ đang hỏi nhận diện, chẩn đoán phân biệt, ý nghĩa xét nghiệm hay nguyên tắc xử trí" : relational ? "hỏi quan hệ, nguyên nhân hoặc hệ quả cụ thể; có thể cho thay đổi một điều kiện rồi suy kết quả được nguồn hỗ trợ" : "đặt hai khái niệm gần nhau hoặc một ví dụ phân loại; tránh câu điền lại nguyên văn"}.
${includeCommon ? ASSESSMENT_ITEM_RULES : ""}`;
}

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
