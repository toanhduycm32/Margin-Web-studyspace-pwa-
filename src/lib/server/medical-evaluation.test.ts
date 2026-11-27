import { afterEach, expect, it } from "vitest";
import { generateChunkQuestions, summarizeChunk } from "./nvidia";

const nativeFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = nativeFetch; });

// Opt-in live evaluation uses short paraphrases of primary educational guidance:
// https://www.ada.org/resources/research/science/evidence-based-dental-research/antibiotics-for-dental-pain-and-swelling
// https://www.who.int/publications-detail-redirect/9789240000124
it.skipIf(process.env.RUN_MEDICAL_EVAL !== "1")("evaluates conditional dental and medical teaching", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    if (process.env.RUN_MEDICAL_EVAL_FALLBACK === "1" &&
        JSON.parse(String((args[1] as RequestInit)?.body)).model === "mistralai/mistral-large-4-1t-a52b") {
      throw new DOMException("diagnostic fallback", "TimeoutError");
    }
    const response = await originalFetch(...args);
    if (String(args[0]).includes("integrate.api.nvidia.com") && response.ok) {
      const data = await response.clone().json() as { model?: string; choices?: Array<{ message?: { content?: string } }> };
      console.log("MEDICAL_MODEL_OUTPUT", data.model, JSON.stringify(data.choices?.[0]?.message?.content?.slice(0, 1600)));
    }
    return response;
  };
  const dental = `Page 1\nDental antibiotic stewardship. The 2019 ADA guidance for immunocompetent adults with symptomatic irreversible pulpitis and immediately available definitive conservative dental treatment advises against antibiotics as an adjunct to that treatment. Dental treatment is prioritized. A different pathway applies if the condition progresses to systemic involvement with fever or malaise. These conditions must not be collapsed into one blanket antibiotic rule.`;
  const ferritin = `Page 1\nIron status and inflammation. The WHO ferritin guidance states that in adults with infection or inflammation, ferritin below 70 micrograms per liter may indicate iron deficiency. This is a conditional recommendation based on low-certainty evidence. Inflammation can affect ferritin interpretation. This threshold is tied to the stated population and does not alone establish a treatment choice.`;
  const reserve = async () => {};
  const dentalSummary = await summarizeChunk(dental, 1, 1, "clinical", "Dental antibiotic stewardship", "heading", 100, reserve);
  const dentalItems = await generateChunkQuestions(dental, ["single_best"], ["management"], 1, 1,
    "Dental antibiotic stewardship", reserve);
  const medicalItems = await generateChunkQuestions(ferritin, ["select_all"], ["investigation"], 1, 1,
    "Iron status and inflammation", reserve);
  expect(dentalSummary.length).toBeGreaterThan(100);
  expect(dentalItems).toHaveLength(1);
  expect(medicalItems).toHaveLength(1);
  expect(medicalItems[0].correctOptionIds.length).toBeGreaterThan(1);
  console.log("DENTAL_SUMMARY", dentalSummary);
  console.log("DENTAL_ITEM", JSON.stringify(dentalItems[0]));
  console.log("MEDICAL_ITEM", JSON.stringify(medicalItems[0]));
}, 240_000);
