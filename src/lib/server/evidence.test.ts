import { afterEach, describe, expect, it, vi } from "vitest";
import { publicEvidenceQuery, retrieveEvidence } from "./evidence";

afterEach(() => vi.unstubAllGlobals());

describe("public research lookup", () => {
  it("recognizes an accented Vietnamese topic without changing its privacy boundary", () => {
    expect(publicEvidenceQuery("Chẩn đoán đái tháo đường", "medical")).toBe("diabetes mellitus management");
    expect(publicEvidenceQuery("Chẩn đoán đái tháo đường".normalize("NFD"), "medical")).toBe("diabetes mellitus management");
  });
  it("sends only a fixed public topic, not private PDF text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ resultList: { result: [{
      source: "MED", id: "12345678", title: "A review of pulpitis", pubYear: "2024",
      abstractText: "A".repeat(250),
    }] } }));
    vi.stubGlobal("fetch", fetchMock);
    const source = "Patient Jane Smith, 555-0123, has irreversible pulpitis. PRIVATE-SOURCE-ID";
    expect(publicEvidenceQuery(source, "dental")).toBe("irreversible pulpitis");
    const result = await retrieveEvidence(source, "dental");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ kind: "curated_guideline_note", year: "2015" });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("irreversible+pulpitis");
    expect(url).not.toContain("Jane");
    expect(url).not.toContain("PRIVATE-SOURCE-ID");
    expect(result[1].url).toBe("https://europepmc.org/article/MED/12345678");
  });
  it("does not search an unmatched or general document", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect(await retrieveEvidence("Private calculus notes", "general")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
