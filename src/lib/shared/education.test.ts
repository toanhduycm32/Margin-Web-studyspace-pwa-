import { describe, expect, it } from "vitest";
import { canonicalSummaryTarget, isVietnameseProse, objectiveBlueprint } from "./education";

describe("one Vietnamese learning standard", () => {
  it("allocates a substantial chapter more explanation than a short lecture without padding thin text", () => {
    expect(canonicalSummaryTarget(8000)).toBeGreaterThanOrEqual(200);
    expect(canonicalSummaryTarget(18000)).toBeGreaterThan(400);
    expect(canonicalSummaryTarget(100000)).toBeGreaterThan(2000);
    expect(canonicalSummaryTarget(200)).toBeLessThan(100);
  });
  it("covers every planned objective including the final section and preserves a multiple-answer majority", () => {
    const plans = Array.from({ length: 11 }, (_, section) => ({ limitations: [], objectives:
      Array.from({ length: section + 3 }, (_, index) => ({ id: `s${section}-${index}`, concept: `Khái niệm ${index}`,
        objective: "Giải thích quan hệ cấu tạo và chức năng", sourceExcerpt: "Nguồn mô tả cấu tạo và chức năng", family: "mechanism" })) }));
    const blueprint = objectiveBlueprint(plans);
    expect(blueprint.reduce((sum, part) => sum + part.formats.length, 0)).toBe(88);
    expect(blueprint.at(-1)!.objectives).toHaveLength(13);
    expect(blueprint.flatMap((part) => part.formats).filter((format) => format !== "single_best").length).toBeGreaterThan(44);
  });
  it("rejects English-only teaching prose while allowing international terms in Vietnamese", () => {
    expect(isVietnameseProse("The diagnosis is supported by the clinical findings in the patient.")).toBe(false);
    expect(isVietnameseProse("Men răng có cấu trúc khoáng hóa; ngà nằm phía trong và bao quanh khoang tủy.")).toBe(true);
  });
  it("accepts complete Vietnamese clinical explanations without demanding two stock function words", () => {
    const sentence = "Đúng: nguồn ghi đau tự nhiên thành cơn kéo dài vài phút đến hàng giờ, khoảng cách giữa các cơn đau ngắn.";
    expect(isVietnameseProse(sentence)).toBe(true);
    expect(isVietnameseProse(sentence.normalize("NFD"))).toBe(true);
    expect(isVietnameseProse("The words răng and bệnh refer to teeth and disease, but this explanation is written entirely in English.")).toBe(false);
    expect(isVietnameseProse("Đúng.")).toBe(false);
  });
  it("does not turn a second item family into a duplicate learning objective", () => {
    const plan = { limitations: [], objectives: [{ id: "s1-1", concept: "Cấu tạo", objective: "Phân biệt vị trí men và ngà",
      sourceExcerpt: "Men phủ ngoài thân răng.", family: "anatomical_relation", secondaryFamily: "comparison" }] };
    expect(objectiveBlueprint([plan])[0].objectives).toHaveLength(1);
  });
});
