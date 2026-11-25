import { describe, expect, it } from "vitest";
import { planPdfRange } from "./range";

describe("PDF byte ranges", () => {
  it("does not mislabel a truncated initial response as a full PDF", () => {
    expect(planPdfRange(null, 250_000_000)).toMatchObject({ status: 416 });
  });
  it("caps a requested range at two megabytes", () => {
    expect(planPdfRange("bytes=1000000-9000000", 250_000_000)).toEqual({ range: "bytes=1000000-3097151" });
  });
  it("rejects multiple or invalid ranges", () => {
    expect(planPdfRange("bytes=0-5,10-15", 100)).toMatchObject({ status: 416 });
    expect(planPdfRange("bytes=100-120", 100)).toMatchObject({ status: 416 });
  });
});
