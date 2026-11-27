import { describe, expect, it } from "vitest";
import { allocateQuizBlueprint, classifyStudyDomain, recommendedQuestionCount, responseTargets, sectionWordTarget, SUMMARY_PROFILES } from "./study-rules";

describe("study blueprint and summary profiles", () => {
  it("keeps a majority of assessment items multiple response across available quiz sizes", () => {
    for (const count of [5, 10, 20, 30, 100, 150, 300]) {
      const formats = responseTargets(count);
      expect(formats).toHaveLength(count);
      expect(formats.filter((format) => format !== "single_best").length).toBeGreaterThan(count / 2);
      expect(formats).toContain("select_all");
      expect(formats).toContain("select_n");
    }
  });
  it("allocates across readable sections, including late sections, without assigning scanned pages", () => {
    const plan = allocateQuizBlueprint([
      { sectionId: "first", characters: 2000, conceptSignals: 1 },
      { sectionId: "scanned", characters: 0, conceptSignals: 0 },
      { sectionId: "middle", characters: 9000, conceptSignals: 4 },
      { sectionId: "last", characters: 1500, conceptSignals: 2 },
    ], 5);
    expect(plan.map((item) => item.formats.length)).toEqual(expect.arrayContaining([0]));
    expect(plan[1].formats).toHaveLength(0);
    expect(plan[0].formats.length).toBeGreaterThan(0);
    expect(plan[3].formats.length).toBeGreaterThan(0);
    expect(plan.flatMap((item) => item.formats)).toHaveLength(5);
  });
  it("scales section length by actual source density and profile", () => {
    expect(sectionWordTarget("academic", 12_000)).toBeGreaterThan(sectionWordTarget("academic", 1000));
    expect(sectionWordTarget("deep", 8000)).toBeGreaterThan(sectionWordTarget("concise", 8000));
    expect(Object.keys(SUMMARY_PROFILES)).toEqual(["concise", "academic", "deep", "revision", "clinical"]);
  });
  it("recognizes Vietnamese clinical terms with accented word endings", () => {
    expect(classifyStudyDomain("Điều trị, dược lý, bệnh nhân và chẩn đoán.")).toBe("medical");
    expect(classifyStudyDomain("Điều trị, dược lý, bệnh nhân và chẩn đoán.".normalize("NFD"))).toBe("medical");
    expect(classifyStudyDomain("Periodontal disease, endodontic treatment and gingival inflammation.")).toBe("dental");
  });
  it("plans a substantial medical bank without overloading a single request", () => {
    const chunks = Array.from({ length: 20 }, (_, index) => ({ sectionId: `section-${index + 1}`,
      characters: 12_000, conceptSignals: 14 }));
    expect(recommendedQuestionCount(chunks)).toBeGreaterThanOrEqual(100);
    const plan = allocateQuizBlueprint(chunks, 100, "medical");
    expect(plan.flatMap((chunk) => chunk.formats)).toHaveLength(100);
    expect(plan.every((chunk) => chunk.formats.length <= 10)).toBe(true);
    expect(plan.flatMap((chunk) => chunk.families)).toContain("diagnostic_reasoning");
    expect(classifyStudyDomain("Patients with disease need diagnosis and treatment in clinical medicine.")).toBe("medical");
    const textbook = Array.from({ length: 40 }, (_, index) => ({ sectionId: `section-${index + 1}`,
      characters: 20_000, conceptSignals: 20 }));
    expect(recommendedQuestionCount(textbook)).toBe(300);
    expect(allocateQuizBlueprint(textbook, 300, "dental").every((chunk) => chunk.formats.length <= 10)).toBe(true);
  });
});
