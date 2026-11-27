import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { expect, it } from "vitest";
import type { TextChunk } from "../client/extract";
import type { LearningPlan, QuizQuestionV2 } from "../shared/types";
import { objectiveBlueprint, canonicalSummaryTarget, isVietnameseProse } from "../shared/education";
import { STUDY_RULE_VERSION } from "../shared/study-rules";
import { generateChunkQuestions, planLearning, summarizeChunk } from "./nvidia";
import { retrieveEvidence, type EvidenceSource } from "./evidence";
import { GenerationContinuation, withGenerationCheckpoints, type CheckpointValue } from "./generation-checkpoints";

// Explicit opt-in: actual NVIDIA requests consume quota. Source and outputs stay
// in a caller-selected private file, never in committed fixtures or test logs.
it.skipIf(!process.env.MARGIN_LIVE_BOOK)("evaluates the complete Vietnamese textbook with resumable real model calls", async () => {
  const sourcePath = process.env.MARGIN_LIVE_BOOK!;
  const output = process.env.MARGIN_LIVE_OUTPUT!;
  if (!output) throw new Error("An output checkpoint path is required.");
  const source = await readFile(sourcePath, "utf8");
  const { chunks } = JSON.parse(source) as { chunks: TextChunk[] };
  const signature = createHash("sha256").update(source + STUDY_RULE_VERSION).digest("hex");
  type State = { signature: string; calls: number; models: string[]; plans: LearningPlan[];
    summaries: Record<number, string>; batches: Record<string, QuizQuestionV2[]>; events: unknown[];
    checkpoints: Record<string, CheckpointValue>; evidence: Record<number, EvidenceSource[]> };
  let state: State = { signature, calls: 0, models: [], plans: [], summaries: {}, batches: {}, events: [], checkpoints: {}, evidence: {} };
  try { const saved = JSON.parse(await readFile(output, "utf8")); if (saved.signature === signature) state = saved; }
  catch { /* First run. */ }
  const persist = () => writeFile(output, JSON.stringify(state, null, 2));
  if (process.env.MARGIN_EVAL_CAPTURE === "1") {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      if (String(input).startsWith("https://integrate.api.nvidia.com/")) {
        await writeFile(`${output}.response-${state.calls}.json`, await response.clone().text());
      }
      return response;
    };
  }
  const reserve = async () => {
    if (state.calls >= Number(process.env.MARGIN_EVAL_MAX_CALLS || 180)) throw new Error("Evaluation call budget reached; checkpoint retained.");
    state.calls++; await persist();
  };
  const model = (name: string) => { if (!state.models.includes(name)) state.models.push(name); };
  const resumable = async <T>(scope: string, operation: () => Promise<T>): Promise<T> => {
    state.checkpoints ||= {}; state.evidence ||= {};
    let unavailable = 0;
    for (let request = 0; request < 80; request++) {
      try { return await withGenerationCheckpoints({
        read: async (key) => state.checkpoints[`${scope}:${key}`] || null,
        write: async (key, value) => { state.checkpoints[`${scope}:${key}`] = value; await persist(); },
      }, operation); }
      catch (error) {
        if (error instanceof GenerationContinuation) unavailable = 0;
        else if (error && typeof error === "object" && "status" in error && error.status === 503 && unavailable < 3) unavailable++;
        else throw error;
        state.events.push({ phase: "resume", reason: error instanceof GenerationContinuation ? "saved-step" : "service-unavailable", calls: state.calls });
        await persist();
      }
    }
    throw Error("Evaluation request bound reached; private checkpoints retained.");
  };
  const started = Date.now();
  for (let index = 0; process.env.MARGIN_BOOK_PHASE !== "summary" && index < chunks.length; index++) {
    if (state.plans[index]) continue;
    const chunk = chunks[index];
    const result = chunk.section!.role === "front_matter" ? { objectives: [], limitations: [] }
      : await resumable(`plan-${index}`, () => planLearning(chunk.text, chunk.section!.title, `s${index}`, reserve, AbortSignal.timeout(240_000), model));
    state.plans[index] = result;
    state.events.push({ phase: "plan", index, objectives: result.objectives.length, calls: state.calls, elapsedMs: Date.now() - started });
    await persist();
  }
  const blueprint = objectiveBlueprint(state.plans);
  const count = blueprint.reduce((sum, item) => sum + item.formats.length, 0);
  if (process.env.MARGIN_BOOK_PHASE !== "summary") {
    expect(count).toBeGreaterThanOrEqual(40);
    expect(state.plans.filter((plan) => plan.objectives.length).length).toBe(chunks.filter((chunk) => chunk.section!.role !== "front_matter").length);
  }
  if (process.env.MARGIN_BOOK_PHASE === "plan") return;
  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];
    if (chunk.section!.role === "front_matter") continue;
    state.evidence ||= {};
    const evidence = state.evidence[index] ||= await retrieveEvidence(chunk.text, "dental");
    await persist();
    if (process.env.MARGIN_BOOK_PHASE !== "quiz" && !state.summaries[index]) {
      state.summaries[index] = await resumable(`summary-${index}`, () => summarizeChunk(chunk.text, chunk.startPage, chunk.endPage, "medical",
        chunk.section!.title, chunk.section!.source, Math.min(1800, canonicalSummaryTarget(chunk.text.length)),
        reserve, AbortSignal.timeout(240_000), evidence, model));
      expect(isVietnameseProse(state.summaries[index])).toBe(true);
      state.events.push({ phase: "summary", index, words: state.summaries[index].split(/\s+/u).length, calls: state.calls });
      await persist();
    }
    if (process.env.MARGIN_BOOK_PHASE === "summary") continue;
    const part = blueprint[index];
    for (let offset = 0; offset < part.formats.length; offset += 2) {
      const key = `${index}-${offset}`;
      if (state.batches[key]) continue;
      const previous = Object.entries(state.batches).filter(([key]) => key.startsWith(`${index}-`)).flatMap(([, questions]) => questions.map((q) => q.question));
      state.batches[key] = await resumable(`quiz-${index}`, () => generateChunkQuestions(chunk.text, part.formats.slice(offset, offset + 2),
        part.families.slice(offset, offset + 2), chunk.startPage, chunk.endPage, chunk.section!.title,
        reserve, AbortSignal.timeout(240_000), evidence, model, part.objectives.slice(offset, offset + 2), previous));
      state.events.push({ phase: "quiz", index, offset, count: state.batches[key].length, calls: state.calls });
      await persist();
    }
  }
  if (process.env.MARGIN_BOOK_PHASE !== "quiz") expect(Object.keys(state.summaries).length).toBe(chunks.length - 1);
  if (process.env.MARGIN_BOOK_PHASE !== "summary") expect(Object.values(state.batches).flat()).toHaveLength(count);
}, 7_200_000);
