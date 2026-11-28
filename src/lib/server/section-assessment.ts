import { callNvidia, parseObject, modelForSource } from "./nvidia";
import { indexedEvidence, attachSourceExcerpts } from "./generation-input";
import { AssessmentValidationError, validateQuestionsV2 } from "../shared/quiz";
import { isVietnameseProse, relevantKnowledgeRules, VIETNAMESE_STANDARD } from "../shared/education";
import { QUESTION_FAMILIES } from "../shared/study-rules";
import type { QuizQuestionV2, ResponseType } from "../shared/types";
import { evidencePrompt, type EvidenceSource } from "./evidence";
import { AppError } from "./errors";

export function sectionItems(value: unknown, source: string, formats: ResponseType[], start: number, end: number): QuizQuestionV2[] {
  if (!Array.isArray(value) || value.length !== formats.length) throw new AssessmentValidationError("Thiếu câu hỏi trong nhóm được giao.");
  const raw = value.map((item, index) => ({ question: item?.question, options: item?.options?.map?.((o: { text: string }) => o.text),
    option_explanations: item?.options?.map?.((o: { why: string }) => o.why), correct_option_ids:
      Array.isArray(item?.options) && item.options.every((o: { correct: unknown }) => typeof o?.correct === "boolean")
        ? item.options.flatMap((o: { correct: boolean }, i: number) => o.correct ? [i] : []) : item?.correct,
    explanation: item?.explanation, evidence_id: item?.evidence, question_family: item?.family,
    cognitive_demand: item?.demand, difficulty: "intermediate", response_type: formats[index],
    selection_count: formats[index] === "select_n" ? (Array.isArray(item?.options) && item.options.every((o: { correct: unknown }) => typeof o?.correct === "boolean")
      ? item.options.filter((o: { correct: boolean }) => o.correct).length : Array.isArray(item?.correct) ? item.correct.length : null) : null }));
  const checked = validateQuestionsV2(attachSourceExcerpts(raw, indexedEvidence(source).passages), source,
    formats, raw.map((item) => item.question_family), start, end);
  if (checked.some((q) => !isVietnameseProse(`${q.question} ${q.explanation}`) ||
      q.optionExplanations.some((why) => !isVietnameseProse(why)))) {
    throw new AssessmentValidationError("Câu hỏi và lời giải phải là câu tiếng Việt có nghĩa.");
  }
  return checked;
}

type Review = { valid: boolean; issues: Array<{ index: number; reason: string }> };
export function sectionReview(value: Record<string, unknown>, questions: QuizQuestionV2[]): Review {
  const items = value.items;
  if (!Array.isArray(items) || items.length !== questions.length || items.some((item, index) =>
    !item || item.index !== index + 1 || !Array.isArray(item.correct) ||
    item.correct.some((key: unknown) => !Number.isInteger(key) || Number(key) < 0 || Number(key) >= questions[index].options.length) ||
    new Set(item.correct).size !== item.correct.length || !Array.isArray(item.issues) ||
    item.issues.some((issue: unknown) => typeof issue !== "string" || !issue.trim() || issue.length > 1000))) {
    throw new AppError(502, "Kết quả kiểm tra chưa bao gồm đủ từng câu. Bản nháp được giữ để tiếp tục kiểm tra.");
  }
  const issues = items.flatMap((item, index) => {
    const keyChanged = JSON.stringify([...item.correct].sort((a, b) => a - b)) !== JSON.stringify(questions[index].correctOptionIds);
    const reasons = [...item.issues];
    if (keyChanged) reasons.push(`Khóa do bước kiểm tra độc lập xác định là [${item.correct.join(",")}], khác khóa bản nháp; cần đối chiếu lại nguồn và điều kiện câu dẫn.`);
    return reasons.length ? [{ index: index + 1, reason: reasons.join(" ").slice(0, 1000) }] : [];
  });
  return { valid: !issues.length, issues };
}

export async function reviewSectionQuestions(source: string, questions: QuizQuestionV2[], reserve: () => Promise<void>,
  signal?: AbortSignal, evidence: EvidenceSource[] = [], onModelUsed?: (model: string) => void): Promise<Review> {
  // Require an answer set for every item without supplying its index array.
  // Explanations remain visible for claim checking: this is not a blinded audit.
  const input = questions.map((q, index) => ({ index: index + 1, format: q.responseType, question: q.question,
    options: q.options, explanation: q.explanation, optionExplanations: q.optionExplanations }));
  const prompt = `Đọc nguồn rồi tự xác định TẤT CẢ lựa chọn đúng cho TỪNG câu dưới đây; không có mảng chỉ số đáp án mẫu. Lời giải nháp là nội dung cần kiểm tra, không phải thẩm quyền; kiểm tra cả ý sai hoặc thiếu điều kiện trong từng lời giải. Chỉ số lựa chọn tính từ 0.
Với mỗi câu, giữ rõ đối tượng, giai đoạn, diễn biến, chỉ định, chống chỉ định và ngoại lệ. Nếu câu dẫn thiếu điều kiện để có đáp án duy nhất, báo lỗi; không tự giả định điều kiện còn thiếu. Một kỹ thuật xuất hiện ở mục bệnh khác vẫn có thể đúng cho bệnh trong câu dẫn: không loại lựa chọn chỉ vì nhãn bệnh hay vị trí đoạn nguồn. So sánh cơ chế/hành động thật và điều kiện áp dụng. Phải kiểm tra cả lựa chọn không được chọn, không chỉ tìm một đáp án có vẻ đúng.
Kiểm tra tiếng Việt rõ, nhiễu có căn cứ và các câu khác quan hệ; ưu tiên lý thuyết và lâm sàng nếu nguồn hỗ trợ. Cho phép bộ ôn tập nhỏ, không đòi mọi chi tiết; báo thiếu chủ đề chính thực chất, không sửa phong cách vô hại.
${evidence.length ? evidencePrompt(evidence) : "Chỉ dùng PDF; không tuyên bố đây là hướng dẫn lâm sàng hiện hành."}
Trả duy nhất JSON {"items":[{"index":1,"correct":[0,2],"issues":[]}]}. PHẢI có đúng ${questions.length} mục theo thứ tự 1 đến ${questions.length}. correct có mọi chỉ số đúng (có thể rỗng nếu không đủ căn cứ); issues chỉ gồm lỗi thực chất, nêu quan hệ và điều kiện nguồn. single_best cần duy nhất một đáp án đúng; các dạng còn lại cần ít nhất hai và ít nhất một lựa chọn sai.
<untrusted_pdf_text>\n${source}\n</untrusted_pdf_text>\n<items>\n${JSON.stringify(input)}\n</items>`;
  let feedback = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callNvidia(prompt + feedback, 4500, 0, reserve, signal, onModelUsed, true, undefined, modelForSource(source));
    try { return sectionReview(parseObject(raw), questions); }
    catch (error) {
      if (attempt) throw new AppError(422, "Chưa nhận được kiểm tra đầy đủ cho bộ câu hỏi. Bản hiện hành vẫn được giữ.", "RESTART_GENERATION");
      feedback = `\nKết quả kiểm tra trước sai cấu trúc: ${error instanceof Error ? error.message : "thiếu items"}. Trả lại đầy đủ items theo thứ tự; không tạo lại câu hỏi.`;
    }
  }
  throw new AppError(422, "Chưa nhận được kiểm tra đầy đủ.", "RESTART_GENERATION");
}

const contract = `{"questions":[{"question":"câu dẫn","options":[{"text":"lựa chọn 1","correct":true,"why":"căn cứ đúng"},{"text":"lựa chọn 2","correct":false,"why":"điều kiện bị vi phạm"},{"text":"lựa chọn 3","correct":true,"why":"căn cứ đúng"},{"text":"lựa chọn 4","correct":false,"why":"điều kiện bị vi phạm"}],"explanation":"quan hệ cần hiểu, một hoặc hai câu","evidence":"E1","family":"comparison","demand":"understand"}]}`;

export async function generateSectionQuestions(source: string, formats: ResponseType[], start: number, end: number,
  title: string, reserve: () => Promise<void>, signal?: AbortSignal, evidence: EvidenceSource[] = [],
  onModelUsed?: (model: string) => void): Promise<QuizQuestionV2[]> {
  const instructions = `${VIETNAMESE_STANDARD}
Đọc toàn bộ phần "${title}" rồi tự chọn các quan hệ quan trọng để tạo đúng ${formats.length} câu học tập khác nhau; không xuất kế hoạch riêng.
Bao quát các chủ đề chính ở đầu, giữa, cuối; một câu có thể nối các kiến thức liên quan. Không chép câu tự lượng giá. Có cả lý thuyết và vận dụng lâm sàng nếu nguồn hỗ trợ; không ép giải phẫu thành xử trí. Ca chẩn đoán phải cần suy luận từ dấu hiệu phân biệt, hoặc hỏi giới hạn chứng cứ; không chỉ thêm chữ "bệnh nhân" vào câu nhớ triệu chứng. Giữ đối tượng, thời gian, ngoại lệ, chỉ định, liều và đơn vị. Không tự tạo dữ kiện có thể đổi đáp án.
${relevantKnowledgeRules(source)}
Thứ tự dạng câu: ${JSON.stringify(formats)}. Mỗi câu có đúng 4 lựa chọn độc lập, độ dài tương đương; single_best có duy nhất một lựa chọn correct:true, select_all/select_n có 2 hoặc 3 lựa chọn correct:true. Gắn correct:true/false ngay vào mỗi lựa chọn theo đúng why; KHÔNG xuất mảng chỉ số đáp án, ứng dụng tự tính. Mọi lựa chọn correct:false phải sai dưới điều kiện câu dẫn, không chỉ ít liên quan. Nhiễu đảo quan hệ/điều kiện có trong nguồn; không thêm kiến thức ngoài nguồn. Không dùng "tất cả", nhãn A/B, phụ thuộc câu trước. Mỗi why là một câu ngắn giải thích quan hệ đúng hoặc điều kiện bị vi phạm; explanation giải thích ý chung, không lặp cả bốn why.
Chọn family trong ${QUESTION_FAMILIES.join(",")}; demand trong remember,understand,apply,analyze theo thao tác thực tế. evidence là mã E có thật, ứng dụng tự gắn trích dẫn và các định danh. Tự kiểm tra khóa và các điều kiện trước khi xuất. Trả duy nhất JSON theo cấu trúc ${contract}; mỗi câu phải có đủ 4 options. Không xuất suy nghĩ hay metadata khác.`;
  const indexed = indexedEvidence(source);
  const prompt = `${instructions}\n<untrusted_pdf_text>\n${indexed.text}\n</untrusted_pdf_text>`;
  let raw: unknown;
  let questions: QuizQuestionV2[];
  let structuralFeedback = "";
  // One structural retry, never retry a timeout/quota/provider failure here.
  for (let attempt = 0; ; attempt++) {
    const answer = await callNvidia(prompt + structuralFeedback,
      isVietnameseProse(source) ? 8500 : 1000 + formats.length * 1200, 0, reserve, signal, onModelUsed, true, undefined, modelForSource(source));
    try { raw = parseObject(answer).questions; questions = sectionItems(raw, source, formats, start, end); break; }
    catch (error) {
      if (!(error instanceof AssessmentValidationError || error instanceof AppError)) throw error;
      if (attempt) throw new AppError(422, "AI chưa trả được nhóm câu có cấu trúc và chứng cứ hợp lệ. Bản hiện hành vẫn được giữ.", "RESTART_GENERATION");
      structuralFeedback = `\nSửa lỗi cấu trúc cụ thể: ${error.message.slice(0, 350)}. Giữ đúng thứ tự dạng câu đã giao, trả đủ nhóm JSON và tất cả lựa chọn.`;
    }
  }
  const review = (items: QuizQuestionV2[]) => reviewSectionQuestions(source, items, reserve, signal, evidence, onModelUsed);
  let audit = await review(questions!);
  if (!audit.valid) {
    // Keep every unaffected item byte-for-byte; one bounded selective repair.
    const slots = audit.issues.map((issue) => issue.index - 1);
    const repairInstructions = instructions.replace(`đúng ${formats.length} câu`, `đúng ${slots.length} câu`)
      .replace(JSON.stringify(formats), JSON.stringify(slots.map((i) => formats[i])));
    const repaired = await callNvidia(`${repairInstructions}\nChỉ thay ${slots.length} câu bị lỗi sau theo thứ tự dưới đây. Những câu khác đã giữ, không lặp lại chúng.\n${JSON.stringify(audit.issues.map((issue) => ({ ...issue, item: (raw as unknown[])[issue.index - 1] })))}\nCác câu giữ lại: ${JSON.stringify(questions!.filter((_, index) => !slots.includes(index)).map((q) => q.question))}\n<untrusted_pdf_text>\n${indexed.text}\n</untrusted_pdf_text>`,
      isVietnameseProse(source) ? 8500 : 1000 + slots.length * 1200, 1024, reserve, signal, onModelUsed, true, undefined, modelForSource(source));
    let replacements: QuizQuestionV2[];
    try { replacements = sectionItems(parseObject(repaired).questions, source, slots.map((i) => formats[i]), start, end); }
    catch { throw new AppError(422, "Câu sửa chưa có cấu trúc và chứng cứ hợp lệ. Bản hiện hành vẫn được giữ.", "RESTART_GENERATION"); }
    slots.forEach((slot, index) => { questions![slot] = { ...replacements[index], id: questions![slot].id }; });
    audit = await review(questions!);
  }
  if (!audit.valid) throw new AppError(422, "Một số câu vẫn thiếu căn cứ sau khi sửa. Đã giữ bản hiện hành; phần này chưa được lưu thành học liệu.", "RESTART_GENERATION");
  return questions!;
}
