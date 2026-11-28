// Selection owns content; the model may only repair whitespace in a selected span.
// A failed cosmetic edit falls back to the original span, never to guessed prose.
export function summarySourceLines(source: string): string[] {
  return source.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line && !/^Page \d+$/u.test(line));
}

function characters(text: string): string {
  return text.normalize("NFC").replace(/[–—−]/gu, "-").replace(/\s/gu, "");
}

export function selectedSourceText(original: string, proposed: unknown): string {
  const numbers = (text: string) => JSON.stringify(text.replace(/[–—−]/gu, "-").match(/[+-]?\d+(?:[.,]\d+)?/gu) || []);
  return typeof proposed === "string" && characters(proposed) === characters(original) && numbers(proposed) === numbers(original)
    ? proposed.trim() : original.trim();
}

export const summarySelectionSchema = { type: "object", properties: {
  blocks: { type: "array", items: { type: "object", properties: {
    heading: { type: "integer" }, title: { type: "string" },
    passages: { type: "array", items: { type: "object", properties: {
      from: { type: "integer" }, to: { type: "integer" }, text: { type: "string" },
    }, required: ["from", "to", "text"], additionalProperties: false } },
  }, required: ["heading", "title", "passages"], additionalProperties: false } },
}, required: ["blocks"], additionalProperties: false };

export function summarySelectionPrompt(source: string, title: string, target: number): string {
  const lines = summarySourceLines(source);
  return `Chọn lọc nội dung để ôn tập phần "${title}" từ các dòng nguồn S bên dưới. Không viết bài mới hoặc kế hoạch. Chọn những định nghĩa, quan hệ/chức năng, nguyên nhân, điểm phân biệt và điều kiện điều trị chính. Lược danh sách chi tiết phụ, ví dụ và mô tả lặp. Bản tóm tắt nên ngắn hơn nguồn rõ rệt (gợi ý khoảng ${target} đơn vị tách bằng khoảng trắng, có thể dài hơn để giữ điều kiện); không chép gần hết nguồn. Thường chỉ cần vài nhóm đoạn dưới các đề mục chính, không tách mỗi dòng thành một mục.
Trả JSON {"blocks":[{"heading":1,"title":"đề mục nguyên văn đã sửa cách chữ","passages":[{"from":2,"to":4,"text":"toàn bộ các dòng S2 đến S4, chỉ sửa cách chữ"}]}]}. heading là số dòng S có đề mục thật; title chỉ sửa khoảng trắng của chính dòng đó. from/to là số dòng đầu/cuối của một đoạn LIÊN TIẾP được chọn, tính cả hai đầu. Mỗi text chứa nguyên đoạn đó, đúng thứ tự từ; chỉ sửa khoảng trắng/Unicode ghép dấu khi chắc chắn, KHÔNG thay từ, bỏ từ, diễn giải hoặc mở rộng chữ viết tắt. Nếu không chắc cách chữ, chép nguyên nguồn. Ứng dụng lấy nội dung theo số dòng; sửa khác chữ sẽ được thay bằng đoạn nguồn gốc.
Chọn đủ câu, không bắt đầu/kết thúc giữa một câu xuống dòng. Nếu một danh sách cần câu dẫn/điều kiện, chọn cả câu dẫn và điều kiện. Giữ nguyên đối tượng, phủ định, chiều nhân quả, số/đơn vị, ngoại lệ và điều kiện giới hạn chỉ định. Các đoạn giữ theo thứ tự nguồn, không chồng lặp; mỗi block phải có đoạn nội dung thực tế. Không lấy tác giả, số trang, mục tiêu học tập, chú thích hình hoặc câu tự lượng giá. Không đoán chữ/ký hiệu không rõ. Không cần điền mọi chủ đề nhỏ. Không tự thêm kiến thức hay heading mới.
<untrusted_pdf_text>\n${lines.map((line, index) => `[S${index + 1}] ${line}`).join("\n")}\n</untrusted_pdf_text>`;
}

export function renderSummarySelection(value: Record<string, unknown>, source: string): string {
  const lines = summarySourceLines(source);
  if (!Array.isArray(value.blocks) || !value.blocks.length || value.blocks.length > 32) throw new Error("blocks phải là các nhóm đoạn có nội dung.");
  let last = 0;
  const result: string[] = [];
  for (const block of value.blocks) {
    if (!block || !Number.isInteger(block.heading) || block.heading < 1 || block.heading > lines.length ||
        lines[block.heading - 1].length > 200 || !/\p{L}/u.test(lines[block.heading - 1]) ||
        !Array.isArray(block.passages) || !block.passages.length || block.passages.length > 32) throw new Error("Mỗi nhóm cần heading có thật và các đoạn được chọn.");
    result.push(`### ${selectedSourceText(lines[block.heading - 1], block.title)}`);
    for (const passage of block.passages) {
      if (!passage || !Number.isInteger(passage.from) || !Number.isInteger(passage.to) ||
          passage.from <= last || passage.to < passage.from || passage.to > lines.length ||
          block.heading > passage.from) throw new Error("Các đoạn phải chỉ tới dòng nguồn có thật, sau đề mục, theo thứ tự và không chồng lặp.");
      const original = lines.slice(passage.from - 1, passage.to).join("\n");
      result.push(selectedSourceText(original, passage.text));
      last = passage.to;
    }
  }
  return result.join("\n\n");
}
