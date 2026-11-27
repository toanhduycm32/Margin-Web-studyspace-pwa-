import type { StudyDomain } from "@/lib/shared/study-rules";

export type EvidenceSource = { title: string; year: string; url: string; abstract: string;
  kind?: "curated_guideline_note" | "research_abstract"; reviewedAt?: string };

const mohPdf = "https://storage-vnportal.vnpt.vn/cbg-ubnd/sitefolders/syt/uploads/tai-lieu-chuyen-mon/2016_09/huong-dan-chan-doan-dieu-tri-mot-so-benh-ve-rang-ham-mat.pdf";
// Narrow, manually checked notes; neither full guidelines nor a live currency check.
// Vietnamese government clinical guidance is prioritized over research abstracts.
export function curatedEvidence(source: string, domain: StudyDomain): EvidenceSource[] {
  if (domain !== "dental") return [];
  const text = source.normalize("NFC").toLocaleLowerCase("vi");
  const result: EvidenceSource[] = [];
  const note = (title: string, page: number, abstract: string) => result.push({ title: `Bộ Y tế — ${title} (3108/QĐ-BYT)`,
    year: "2015", url: `${mohPdf}#page=${page}`, abstract,
    kind: "curated_guideline_note", reviewedAt: "2026-11-27" });
  if (/viêm lợi|gingivitis|mảng bám/.test(text)) note("Viêm lợi liên quan đến mảng bám răng", 28,
    "Ghi chú đối chiếu mục 6, trang in 27–28: phạm vi là viêm lợi liên quan mảng bám. Tổn thương ở mô lợi; các đặc điểm được nêu gồm không mất bám dính quanh răng và không có hình ảnh tiêu xương ổ răng. Không áp dụng ghi chú này cho mọi dạng bệnh lợi hoặc thay thế toàn bộ tiêu chuẩn chẩn đoán.");
  if (/viêm tủy|pulpitis/.test(text)) note("Viêm tủy răng", 48,
    "Ghi chú đối chiếu mục 11, trang in 47–49: chẩn đoán phân biệt viêm tủy có hồi phục, viêm tủy không hồi phục và các bệnh liên quan dựa trên dấu hiệu lâm sàng cùng cận lâm sàng. Viêm tủy có hồi phục có thể không có triệu chứng. Không suy chẩn đoán xác định chỉ từ một biểu hiện đau.");
  if (/kháng sinh|antibiotic/.test(text)) result.push({
    title: "American Dental Association — Antibiotic Stewardship", year: "2026",
    url: "https://www.ada.org/resources/ada-library/oral-health-topics/antibiotic-stewardship",
    abstract: "Ghi chú đối chiếu phần Key Points và khuyến nghị năm 2026: chỉ định kháng sinh cần xét bối cảnh, nguy cơ, hướng dẫn quốc gia và địa phương; điều trị nha khoa giải quyết nguyên nhân giữ vai trò chính. Không diễn giải ghi chú ngắn này thành quy tắc dùng thuốc cho mọi tình huống hoặc suy liều điều trị.",
    kind: "curated_guideline_note", reviewedAt: "2026-11-27",
  });
  return result;
}

// Only these public, broad topic strings leave the server. Never put PDF text, a patient
// vignette, a document title, or user data in the external search URL.
const topics: Array<{ match: RegExp; query: string; domain: StudyDomain }> = [
  { match: /(?<![\p{L}\p{N}_])(?:pulpitis|tủy răng)(?![\p{L}\p{N}_])/iu, query: "irreversible pulpitis", domain: "dental" },
  { match: /(?<![\p{L}\p{N}_])(?:caries|sâu răng)(?![\p{L}\p{N}_])/iu, query: "dental caries", domain: "dental" },
  { match: /(?<![\p{L}\p{N}_])(?:periodont\w*|nha chu|viêm quanh răng|viêm lợi)(?![\p{L}\p{N}_])/iu, query: "periodontal disease", domain: "dental" },
  { match: /(?<![\p{L}\p{N}_])(?:antibiotic\w*|kháng sinh)(?![\p{L}\p{N}_])/iu, query: "dental antibiotic prescribing", domain: "dental" },
  { match: /(?<![\p{L}\p{N}_])(?:iron deficiency|thiếu máu thiếu sắt)(?![\p{L}\p{N}_])/iu, query: "iron deficiency anemia", domain: "medical" },
  { match: /(?<![\p{L}\p{N}_])(?:hypertension|tăng huyết áp)(?![\p{L}\p{N}_])/iu, query: "hypertension management", domain: "medical" },
  { match: /(?<![\p{L}\p{N}_])(?:diabetes|đái tháo đường)(?![\p{L}\p{N}_])/iu, query: "diabetes mellitus management", domain: "medical" },
  { match: /(?<![\p{L}\p{N}_])(?:asthma|hen phế quản)(?![\p{L}\p{N}_])/iu, query: "asthma management", domain: "medical" },
];

export function publicEvidenceQuery(source: string, domain: StudyDomain): string | null {
  return topics.find((topic) => topic.domain === domain && topic.match.test(source.normalize("NFC")))?.query || null;
}

export async function retrieveEvidence(source: string, domain: StudyDomain): Promise<EvidenceSource[]> {
  const curated = curatedEvidence(source, domain);
  const topic = publicEvidenceQuery(source, domain);
  if (!topic) return curated;
  const url = new URL("https://www.ebi.ac.uk/europepmc/webservices/rest/search");
  url.searchParams.set("query", topic);
  url.searchParams.set("format", "json");
  url.searchParams.set("resultType", "core");
  url.searchParams.set("pageSize", "3");
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (!response.ok) return curated;
    const data = await response.json() as { resultList?: { result?: Array<Record<string, unknown>> } };
    const research: EvidenceSource[] = (data.resultList?.result || []).filter((item) => item.source === "MED" &&
      typeof item.id === "string" && /^\d+$/.test(item.id) &&
      typeof item.title === "string" && typeof item.abstractText === "string" &&
      item.abstractText.length > 200).slice(0, 2).map((item) => ({
      title: String(item.title).slice(0, 250), year: String(item.pubYear || "").slice(0, 4),
      url: `https://europepmc.org/article/MED/${item.id}`,
      abstract: String(item.abstractText).replace(/<[^>]*>/g, " ").slice(0, 2000),
      kind: "research_abstract",
    }));
    return [...curated, ...research];
  } catch { return curated; }
}

export function evidencePrompt(sources: EvidenceSource[]): string {
  if (!sources.length) return "No external research was retrieved. Do not imply that an external check occurred.";
  return `Nguồn ngoài để đối chiếu, tách biệt với PDF học tập và nguồn nghiên cứu cách ra đề. Ưu tiên ghi chú Bộ Y tế cho bối cảnh Việt Nam, sau đó hướng dẫn quốc tế và nghiên cứu. Ghi chú đã tuyển chọn chỉ phản ánh phạm vi và năm được ghi, không phải toàn văn hoặc xác nhận còn mới nhất. Tóm lược nghiên cứu không thay thế khuyến cáo thực hành. Chỉ nêu mâu thuẫn hoặc bổ sung có căn cứ trực tiếp; không dùng nguồn ngoài làm đáp án cho điều PDF không dạy. Không sửa ngầm kiến thức PDF, không tạo liều thuốc. Bất đồng phải ghi rõ nguồn, năm và giới hạn.\n${sources.map((item, index) =>
    `${index + 1}. ${item.title} (${item.year}) ${item.url}\n${item.kind === "curated_guideline_note" ? `Ghi chú đã đối chiếu ngày ${item.reviewedAt}, không phải truy xuất mới trong lượt này` : "Tóm lược nghiên cứu truy xuất trong lượt này"}: ${item.abstract}`).join("\n")}`;
}
