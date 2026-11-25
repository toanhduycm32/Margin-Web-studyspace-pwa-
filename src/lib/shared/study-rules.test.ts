import { describe, expect, it } from "vitest";
import { allocateQuizBlueprint, responseTargets, sectionWordTarget, SUMMARY_PROFILES } from "./study-rules";

describe("study blueprint and summary profiles", () => {
  it("keeps a majority of assessment items multiple response across available quiz sizes", () => {
    for (const count of [5, 10, 20, 30]) {
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
    expect(Object.keys(SUMMARY_PROFILES)).toEqual(["concise", "academic", "deep", "revision"]);
  });
});
