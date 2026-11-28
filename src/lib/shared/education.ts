import type { LearningObjective, LearningPlan, ResponseType } from "./types";

export const VIETNAMESE_STANDARD = `Viết bằng tiếng Việt học thuật tự nhiên cho sinh viên Y khoa và Răng Hàm Mặt. Giải thích quan hệ nhân quả bằng câu hoàn chỉnh, không dịch sát cấu trúc tiếng Anh. Giữ thuật ngữ của giáo trình; không tự đổi "lợi" thành "nướu", "quanh răng" thành "nha chu" nếu làm lệch nghĩa. Có thể giới thiệu từ tương đương Anh/Latin một lần khi cần. Giữ nguyên số, đơn vị, ký hiệu răng, tên thuốc, phân loại và điều kiện áp dụng. Phân biệt triệu chứng cơ năng/dấu hiệu thực thể, yếu tố nguy cơ/nguyên nhân, chỉ định/chống chỉ định, tương quan/nhân quả. Không viết lời mở đầu hay kết luận chung chung. Trích dẫn nguồn giữ nguyên ngôn ngữ nguồn; phần giảng giải, câu hỏi và phản hồi phải bằng tiếng Việt. Không nhận diện hay tư vấn cho bệnh nhân thật.`;

export const KNOWLEDGE_RULES = {
  anatomy: "Giải phẫu: giữ cấu trúc, vị trí, hướng, mặt gần/xa, liên quan và chức năng; không suy hình ảnh từ chú thích. Phân biệt răng sữa/răng vĩnh viễn, thân/chân răng, men/ngà/tủy.",
  physiology: "Sinh lý và sinh lý bệnh: nối tác nhân → biến đổi → hệ quả; giữ điều hòa, trình tự, phản hồi và điều kiện. Không biến một liên quan thành cơ chế đã chứng minh.",
  pathology: "Bệnh học: phân biệt căn nguyên, yếu tố nguy cơ, bệnh sinh, tổn thương, tiến triển và biến chứng; giữ phân loại và điểm phân biệt của nguồn.",
  clinical: "Lâm sàng: giữ triệu chứng, dấu hiệu, diễn biến, chẩn đoán phân biệt, xét nghiệm và giới hạn suy luận. Không tự thêm tuổi, bệnh nền, thuốc hoặc kết quả có thể đổi đáp án.",
  treatment: "Điều trị/dược lý: giữ đối tượng, mức độ bệnh, chỉ định, chống chỉ định, cơ chế, bất lợi, tương tác, liều/đơn vị và điều kiện nếu nguồn có. Không bổ sung liều hoặc biến nguyên tắc học tập thành đơn thuốc.",
  materials: "Vật liệu nha khoa: nối thành phần/cấu trúc với tính chất, thao tác, ứng dụng và hạn chế; giữ đơn vị và điều kiện thử nghiệm. Không suy ưu thế lâm sàng từ một tính chất riêng.",
  prevention: "Dự phòng/y tế công cộng: phân biệt nguy cơ cá nhân và quần thể, biện pháp và kết cục, dự phòng ban đầu và xử trí bệnh; giữ điều kiện triển khai.",
} as const;

export function relevantKnowledgeRules(text: string): string {
  const value = text.normalize("NFC").toLocaleLowerCase("vi");
  const rules: string[] = [];
  if (/giải phẫu|cấu tạo|anatom|men răng|ngà răng|khớp cắn/.test(value)) rules.push(KNOWLEDGE_RULES.anatomy);
  if (/sinh lý|cơ chế|điều hòa|physiolog/.test(value)) rules.push(KNOWLEDGE_RULES.physiology);
  if (/bệnh|viêm|patholog|tổn thương/.test(value)) rules.push(KNOWLEDGE_RULES.pathology);
  if (/chẩn đoán|triệu chứng|lâm sàng|diagnos|clinical/.test(value)) rules.push(KNOWLEDGE_RULES.clinical);
  if (/điều trị|thuốc|chống chỉ định|treatment|pharmacol/.test(value)) rules.push(KNOWLEDGE_RULES.treatment);
  if (/vật liệu|xi măng|composite|polymer|độ bền/.test(value)) rules.push(KNOWLEDGE_RULES.materials);
  if (/dự phòng|phòng bệnh|prevention|cộng đồng/.test(value)) rules.push(KNOWLEDGE_RULES.prevention);
  return rules.join("\n");
}

// Original calibration cases. They teach construction, not additional facts to import
// into a learner's source. Only relevant cases are included in each prompt.
export const VI_CALIBRATION = {
  summary: `Hiệu chuẩn tóm tắt (ví dụ tự biên soạn, không phải kiến thức bổ sung):
Nguồn mẫu: Men phủ thân răng; ngà nằm dưới men và bao quanh khoang tủy. Tủy chứa mạch máu và thần kinh. Mục tiêu: giải thích quan hệ cấu tạo.
Bản yếu: "Răng gồm men, ngà, tủy." Thiếu vị trí và liên quan. Sửa: "Ở thân răng, men tạo lớp phủ ngoài; phía trong là ngà bao quanh khoang tủy. Tủy chứa mạch máu và thần kinh. Cách sắp xếp này cần được phân biệt với việc chỉ liệt kê ba mô." Không thêm tỷ lệ khoáng hay chức năng ngoài nguồn.
Nguồn mẫu: Một chỉ định chỉ áp dụng khi có đồng thời điều kiện A và B; C là ngoại lệ. Bản sai: "Phương pháp này được chỉ định cho bệnh đó." Sửa phải giữ A, B và ngoại lệ C; không cắt chúng để đạt độ dài.
Diễn đạt yếu: "Bệnh nhân trình bày với đau." Sửa theo ý nguồn: "Người bệnh có triệu chứng đau." Giữ nguyên mức độ, thời điểm và tác nhân kích thích nếu có.
Đoạn ngắn chỉ có hai quan hệ không cần đủ 200 từ. Một bài nhiều cơ chế phải giải thích từng cơ chế dưới đề mục tương ứng, không nén thành cùng một đoạn.`,
  theory: `Hiệu chuẩn lý thuyết (ví dụ gốc): Nguồn mẫu xác định men phủ thân răng, ngà bao quanh khoang tủy, tủy chứa mạch và thần kinh. Mục tiêu: phân biệt vị trí các mô.
Chọn tất cả đáp án đúng: (a) Men phủ ngoài thân răng; (b) Ngà nằm quanh khoang tủy; (c) Tủy là lớp phủ ngoài thân răng; (d) Ngà chỉ nằm ngoài men. Khóa a,b. Giải thích a/b bằng quan hệ vị trí; c/d đảo vị trí nên sai. Không dùng một sự thật ngoài câu hỏi làm đáp án sai chỉ vì ít liên quan.
Biến thể yếu: hỏi tên mô bằng ba câu gần như giống nhau. Sửa: chỉ giữ một mục tiêu; chuyển câu tiếp sang quan hệ chức năng hoặc phân biệt có chứng cứ khác. Không đổi tên bệnh nhân để tạo "câu mới".
Nguồn có trình tự A→B→C: các lựa chọn phải là các trình tự hoàn chỉnh, không viết "A và C đúng" vì ứng dụng đổi thứ tự hiển thị.`,
  clinical: `Hiệu chuẩn lâm sàng (ví dụ phương pháp, không phải khuyến cáo): Nguồn mẫu nói dấu hiệu P có thể gợi ý bệnh Q, nhưng cần R để phân biệt với S. Mục tiêu: nhận ra giới hạn chẩn đoán.
Ca sai: chỉ nêu P rồi yêu cầu chẩn đoán xác định Q. Sửa: cung cấp R nếu nguồn hỗ trợ, hoặc hỏi vì sao P chưa đủ phân biệt. Không thêm xét nghiệm âm tính để hợp thức hóa đáp án.
Nguồn mẫu: hành động H được chỉ định ở nhóm G với điều kiện A; không áp dụng khi B. Câu chọn nhiều đúng phải giữ G/A; lựa chọn áp dụng H khi B là nhiễu đảo điều kiện. Khóa sai nếu đánh dấu cả H khi B. Giải thích phải chỉ ra điều kiện bị vi phạm, không nói chung "không chính xác".
Một lựa chọn điều trị có thể đúng ở tình huống khác: chỉ được làm nhiễu khi câu dẫn đã giới hạn rõ tình huống hiện tại. Với quyết định tối ưu duy nhất, dùng single_best; không ép thêm đáp án đúng.
Không sao chép câu tự lượng giá của giáo trình. Không đưa các con số, thuốc hoặc điều kiện của ví dụ này vào tài liệu đang học.`,
} as const;

export function canonicalSummaryTarget(characters: number, complexity = 1): number {
  // Count whitespace-delimited Vietnamese units consistently, not English words.
  // A chapter's allocation grows with its content; transport splits share this total.
  return Math.max(35, Math.round(characters * 0.045 * Math.min(1.25, Math.max(1, complexity))));
}

export function objectiveBlueprint(plans: LearningPlan[]): Array<{
  objectives: LearningObjective[]; formats: ResponseType[]; families: string[];
}> {
  const result = plans.map((plan) => {
    const objectives: LearningObjective[] = [];
    const families: string[] = [];
    for (const objective of plan.objectives) {
      objectives.push(objective); families.push(objective.family);
      // A different item family is not a second learning objective. Only independently
      // planned relationships add questions; this avoids inflating the bank by rewording.
    }
    const formats = objectives.map((_, index): ResponseType => index % 4 === 2 ? "select_n" : "select_all");
    return { objectives, families, formats };
  });
  const slots = result.flatMap((part) => part.families.map((family, index) => ({ part, family, index })));
  const priority = new Set(["diagnostic_reasoning", "investigation", "management", "integrated_case", "error_analysis"]);
  // Reserve single-best items first for decisions, without forcing every clinical
  // objective into one format or reducing the requested majority of multiple-correct.
  const ordered = [...slots.filter((slot) => priority.has(slot.family)), ...slots.filter((slot) => !priority.has(slot.family))];
  for (const slot of ordered.slice(0, Math.floor(slots.length * 0.25))) slot.part.formats[slot.index] = "single_best";
  return result;
}

export function isVietnameseProse(text: string): boolean {
  const words = text.normalize("NFC").toLocaleLowerCase("vi").match(/[\p{L}]+/gu) || [];
  const common = new Set(["của", "và", "là", "có", "không", "được", "trong", "các", "một", "với", "để", "khi", "do", "từ", "này", "răng", "bệnh", "tại", "những"]);
  const accented = words.filter((word) => /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/u.test(word)).length;
  // This is a language-presence check, not a fluency/medical-quality verdict.
  // Valid clinical sentences can contain few of the common function words above.
  // Vietnamese orthography provides an independent signal; a few quoted terms
  // inside otherwise English prose must not be enough to pass.
  return words.length >= 5 && accented / words.length >= 0.2 &&
    (words.filter((word) => common.has(word)).length >= Math.min(5, Math.max(2, Math.floor(words.length / 25))) ||
      accented >= 5 && accented / words.length >= 0.35);
}
