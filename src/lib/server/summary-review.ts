import { isVietnameseProse, relevantKnowledgeRules, VIETNAMESE_STANDARD } from "../shared/education";
import { evidencePrompt, type EvidenceSource } from "./evidence";
import { summarySourceLines } from "./summary-selection";

export const SUMMARY_RELATION_RULES = "Giữ nguyên thuật ngữ và quan hệ chủ thể → hành động/chức năng → đối tượng, vị trí, chiều nhân quả, phủ định và điều kiện của nguồn. Không biến chức năng nuôi dưỡng thành quan hệ chứa đựng, hoặc gán chức năng của toàn mô cho một thành phần. Không mở rộng chữ viết tắt khi nguồn chưa định nghĩa; giữ nguyên ký hiệu hoặc lược nó nếu phần ý nghĩa còn lại đã rõ. Không tự thêm tên chất, cấu trúc, phương pháp hay từ tương đương Anh/Latin ngoài nguồn. Chỉ sửa lỗi cách chữ/Unicode khi ý chắc chắn; nếu thuật ngữ hoặc số liệu còn mơ hồ, giữ nguyên và ghi ngắn rằng nguồn chưa rõ. Không suy đoán để làm câu trôi chảy.";

const TRANSLATION_RULES = "For a non-Vietnamese source, produce an idiomatic Vietnamese teaching summary, not a literal word-by-word translation. Translate established anatomical and procedural terms by their domain meaning, not a generic dictionary sense. Use Vietnamese for ordinary medical terminology; retain the original term in parentheses only when it resolves genuine ambiguity. A structural boundary is not necessarily an articulating joint, and nourishing a structure is not supplying or producing that structure. Resolve verb arguments and anatomical referents before translating. Do not introduce a causal connective between independent source statements. Do not use a full English quotation instead of explaining the concept in Vietnamese. Read each final sentence as Vietnamese prose: complete predicate, natural collocation, and unambiguous referents. This is linguistic interpretation of the supplied source, not permission to add clinical knowledge.";

export const summaryOutputSchema = { type: "object", properties: { digest: { type: "string" } },
  required: ["digest"], additionalProperties: false };
export const summaryReviewSchema = { type: "object", properties: {
  checks: { type: "array", items: { type: "object", properties: {
    unit: { type: "integer" }, references: { type: "array", items: { type: "string" } }, issue: { type: "string" },
  }, required: ["unit", "references", "issue"], additionalProperties: false } },
  omissions: { type: "array", items: { type: "string" } },
}, required: ["checks", "omissions"], additionalProperties: false };

export function summaryReviewUnits(digest: string): string[] {
  // PDF line wrapping is not a semantic boundary. Keep a selected passage and
  // its conditions together; headings and blank lines delimit review units.
  const units: string[] = [];
  let passage: string[] = [];
  const flush = () => { if (passage.length) units.push(passage.join("\n")); passage = []; };
  for (const raw of digest.split(/\r?\n/u)) {
    const line = raw.trim();
    if (!line) flush();
    else if (/^#{1,6}\s/u.test(line)) { flush(); units.push(line); }
    else passage.push(line);
  }
  flush();
  return units;
}

function sourceProse(source: string): string {
  return source.split(/\r?\n/u).filter((line) => !/^\s*Page \d+\s*$/u.test(line)).join("\n");
}

function sourceCharacters(text: string): string {
  return text.normalize("NFC").replace(/[–—−]/gu, "-").replace(/(\d)\s+(?=\d)/gu, "$1\u0000").replace(/\s/gu, "");
}

export function sourcePreservingIssue(source: string, digest: string): string | null {
  if (!isVietnameseProse(source)) return null; // Translation cannot be checked by literal source equality.
  const original = sourceCharacters(sourceProse(source));
  const units = digest.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index < units.length; index++) {
    const text = units[index].replace(/^#{1,6}\s+/u, "").replace(/^[-*•]\s+/u, "").replace(/\*\*|__/gu, "");
    if (!original.includes(sourceCharacters(text))) {
      return `Đoạn ${index + 1} không giữ nguyên câu/cụm nguồn: ${text.slice(0, 160)}. Chỉ chọn các câu liên tiếp có thật, có thể sửa khoảng trắng; không thêm, đổi hoặc bỏ từ ở giữa câu. Tách thành đoạn khác khi chuyển sang vị trí nguồn khác.`;
    }
  }
  return null;
}

// A complete, source-indexed decision is required for every heading/passage.
// Existence of an anchor is not a proof of the semantic judgment beside it.
export function validateSummaryReview(value: Record<string, unknown>, source: string, digest: string, evidence: EvidenceSource[] = []) {
  const units = summaryReviewUnits(digest);
  const sourceCount = summarySourceLines(source).length;
  if (!Array.isArray(value.checks) || value.checks.length !== units.length ||
      !Array.isArray(value.omissions) || value.omissions.length > 6 ||
      value.omissions.some((item) => typeof item !== "string" || !item.trim() || item.length > 1200)) {
    throw new Error("Cần đúng một checks cho mỗi đơn vị U theo thứ tự, và omissions là danh sách tối đa 6 lỗi thiếu ý chính.");
  }
  const checks = value.checks.map((check, index) => {
    if (!check || check.unit !== index + 1 || typeof check.issue !== "string" || check.issue.length > 1200 ||
        !Array.isArray(check.references) || check.references.length > sourceCount + evidence.length ||
        new Set(check.references).size !== check.references.length ||
        !check.issue.trim() && !check.references.length) throw new Error(`U${index + 1}: thiếu quyết định hoặc chứng cứ.`);
    for (const ref of check.references) {
      const match = typeof ref === "string" ? /^([EX])([1-9]\d*)$/u.exec(ref) : null;
      if (!match || Number(match[2]) > (match[1] === "E" ? sourceCount : evidence.length)) {
        throw new Error(`U${index + 1}: chỉ dùng mã E hoặc X có thật, mỗi mã là một phần tử riêng.`);
      }
    }
    return { unit: index + 1, references: check.references as string[], issue: check.issue.trim() as string };
  });
  const issues = [...checks.filter((item) => item.issue).map((item) => `U${item.unit}: ${item.issue}`),
    ...value.omissions as string[]];
  return { valid: issues.length === 0, issues, checks };
}

// Page ownership belongs to signed section metadata. A model-written page label
// can be off by one even when the teaching content is supported.
export function summaryWithoutPageLabels(digest: string): string {
  return digest.replace(/\s*\(PDF\s+tr\.?\s*\d+(?:\s*[–—,-]\s*\d+)*\)/giu, "").trim();
}

export function summaryDraftPrompt(source: string, start: number, end: number, sectionTitle: string,
  sectionSource: string, target: number, evidence: EvidenceSource[]) {
  const preserve = isVietnameseProse(source) && !evidence.length;
  return `Viết bản tóm tắt để học phần "${sectionTitle}", trang PDF ${start}–${end}, chỉ từ nguồn dưới đây.
${VIETNAMESE_STANDARD}
${SUMMARY_RELATION_RULES}
${!isVietnameseProse(source) ? TRANSLATION_RULES : ""}
${relevantKnowledgeRules(source)}
Chọn và sắp xếp lại các ý chính thành các đoạn ngắn có quan hệ rõ. Được giữ nguyên câu/cụm từ chính xác của nguồn; không thay từ chuyên môn chỉ để tránh giống bản gốc. Rút gọn bằng cách lược chi tiết phụ, không bằng cách đổi quan hệ. Giữ định nghĩa, cơ chế, phân loại, điều kiện, ngoại lệ và điểm phân biệt có ý nghĩa. Khi tóm tắt xử trí, giữ điều kiện giới hạn chỉ định ngay cạnh biện pháp. Dùng tiêu đề ### từ các đề mục có nội dung thực tế; gộp mục nhỏ, bỏ đề mục cuối đoạn chưa có nội dung. ${sectionSource === "inferred" ? "Tên phần đang dùng là suy luận của ứng dụng; không giới thiệu nó là đề mục gốc." : "Tên phần đã được nhận diện trong PDF."} Không chép mục tiêu học tập, tác giả, mục lục, câu tự lượng giá hay chú thích hình chưa đọc.
${preserve ? "NGUỒN TIẾNG VIỆT — TÓM TẮT CHỌN LỌC NGUYÊN VĂN: Mỗi dòng/đoạn trong digest phải giữ nguyên một câu hoặc một nhóm câu LIÊN TIẾP có thật trong nguồn. Chỉ sửa khoảng trắng bị lỗi và cách xuống dòng; giữ nguyên toàn bộ từ, dấu câu, số và thứ tự từ. Không thêm câu dẫn, không diễn giải hoặc viết lại, không bỏ từ ở giữa câu. Đổi sang đoạn mới khi lấy từ vị trí khác. Tiêu đề ### cũng chọn nguyên văn từ đề mục nguồn (có thể bỏ số thứ tự đứng trước). Chọn đủ cả câu mang điều kiện/ngoại lệ; không cắt nửa câu để ngắn hơn. Ứng dụng sẽ kiểm tra từng dòng với nguồn và từ chối mọi thay đổi từ ngữ. Bỏ nguyên câu/chi tiết phụ để cô đọng; không sao chép toàn chương." : "Nếu cần dịch nguồn, giữ nguyên quan hệ và thuật ngữ; không tự bổ sung kiến thức để làm câu trôi chảy."}
Mỗi câu phải rõ chủ thể của từng động từ. Khi gộp các vế bằng và/hoặc, giữ đủ giới từ và điều kiện để không biến địa điểm thành tác nhân. Nếu rút gọn làm nhập nhằng ai gây ra tác động, giữ nguyên câu nguồn hoặc tách thành hai câu ngắn.
Độ dài gợi ý cho toàn bộ digest: khoảng ${target} đơn vị tách bởi khoảng trắng; đây là hướng dẫn, không phải hạn mức nội dung. Ví dụ "cấu tạo răng" tính là 3 đơn vị. Có thể dài hơn khi cần giữ quan hệ và điều kiện chính; ưu tiên bỏ chi tiết phụ và tránh diễn giải lặp.
${evidence.length ? `Tóm tắt đúng nội dung PDF trước. Chỉ khi nguồn ngoài trực tiếp làm rõ một khác biệt quan trọng mới thêm mục "Đối chiếu nguồn ngoài", ghi URL chính xác và phân biệt rõ với PDF. Không tự cập nhật điều trị của PDF. ${evidencePrompt(evidence)}` : "Chỉ dùng PDF; chưa có đối chiếu nguồn ngoài. Không tuyên bố đây là hướng dẫn y khoa hiện hành hay đã được xác minh."}
Trả duy nhất JSON hoàn chỉnh {"digest":"### Đề mục\\nĐoạn giải thích cô đọng..."}. Không viết lời dẫn hoặc kết luận chung chung. Không tự gắn nhãn số trang vào đoạn văn; ứng dụng gắn khoảng trang của phần nguồn.
<untrusted_pdf_text>\n${sourceProse(source)}\n</untrusted_pdf_text>`;
}

export function summaryReviewPrompt(source: string, digest: string, evidence: EvidenceSource[]) {
  const units = summaryReviewUnits(digest);
  return `Đối chiếu từng đơn vị U của bản tóm tắt với nguồn E, gồm cả tiêu đề. Kiểm tra TẤT CẢ nhận định trong đơn vị, không chỉ câu đầu hoặc một từ trùng nguồn. Với từng nhận định, xác định ai/cái gì, quan hệ gì, với đối tượng nào và dưới điều kiện nào; tìm câu nguồn hỗ trợ. Một thuật ngữ gần giống hoặc cùng xuất hiện không chứng minh được quan hệ đó. Không dùng kiến thức đã biết để hợp thức hóa ý ngoài PDF.
Kiểm tra tên cấu trúc/vật liệu/phương pháp và chữ viết tắt: không chấp nhận cách mở rộng chưa được định nghĩa, từ thay thế đổi khái niệm, hoặc tên riêng mới không có trong nguồn. Kiểm tra từng vế nối bằng và/hoặc: chủ thể của động từ phải rõ trong câu tóm tắt; thiếu giới từ làm một địa điểm/thành phần thành tác nhân là lỗi, không tự điền từ bị thiếu để cho qua. Giữ chiều nhân quả, phủ định, số/đơn vị, thời gian và điều kiện làm thay đổi chẩn đoán/chỉ định. Sai một nhận định thì cả đơn vị phải có issue, dù những câu còn lại đúng.
${!isVietnameseProse(source) ? `${TRANSLATION_RULES} Audit translation quality as well as factual overlap. Reject wrong anatomical senses, changed verb-object relations, untranslated ordinary terminology, incomplete predicates and misleading causal connections even when the surrounding clinical facts are correct. Explain the specific linguistic defect in issue; matching source vocabulary alone does not pass a translated unit.` : ""}
Cho phép giữ nguyên câu nguồn hoặc sửa cách chữ chắc chắn; không yêu cầu diễn đạt mới. Cho phép bỏ chi tiết phụ và mục chỉ có tên. Chỉ ghi omissions nếu thiếu quan hệ chính/điều kiện thực sự làm lệch cách hiểu toàn phần; kiểm tra các đơn vị khác trước khi báo thiếu. Không bắt thêm chi tiết để lấp độ dài.
${evidence.length ? `Nguồn ngoài chỉ hỗ trợ mục được ghi rõ là đối chiếu, không thay nguồn PDF. ${evidence.map((item, index) => `[X${index + 1}] ${evidencePrompt([item])}`).join("\n")}` : "Chưa có nguồn ngoài; không dùng mã X."}
Trả duy nhất JSON {"checks":[{"unit":1,"references":["E1","E2"],"issue":""}],"omissions":[]}. Cần đúng ${units.length} checks, unit từ 1 đến ${units.length} theo thứ tự. references chọn các mã có thật hỗ trợ nhận định hoặc chứng minh lỗi; mỗi mã riêng, không ghi khoảng. issue rỗng chỉ khi toàn đơn vị đúng; nếu sai, trích ngắn cụm sai và nêu quan hệ nguồn chính xác (tối đa 3 câu). Nếu không có chứng cứ cho một ý thì ghi rõ trong issue, không chọn mã liên quan chung để cho qua. Không viết lại bản tóm tắt hoặc thêm lời bình.
<untrusted_pdf_text>\n${summarySourceLines(source).map((line, index) => `[E${index + 1}] ${line}`).join("\n")}\n</untrusted_pdf_text>\n<summary>\n${units.map((unit, index) => `[U${index + 1}] ${unit}`).join("\n")}\n</summary>`;
}
