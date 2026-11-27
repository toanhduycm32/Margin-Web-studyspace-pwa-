import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { it, expect } from "vitest";
import { generateChunkQuestions, summarizeChunk } from "./nvidia";
import { withGenerationCheckpoints, GenerationContinuation, type CheckpointValue } from "./generation-checkpoints";
import { summaryPassages } from "./generation-input";
import { objectiveBlueprint, canonicalSummaryTarget } from "../shared/education";
import { STUDY_RULE_VERSION } from "../shared/study-rules";
import type { TextChunk } from "../client/extract";
import type { LearningPlan, QuizQuestionV2 } from "../shared/types";

// Opt-in qualification of a genuine-source sample, NOT whole-book acceptance.
// No credentials, source PDF or model content is written into tracked files.
it.skipIf(!process.env.MARGIN_STEP_SOURCE)("evaluates checkpointed Vietnamese generation on a genuine textbook sample", async () => {
  const { chunks } = JSON.parse(await readFile(process.env.MARGIN_STEP_SOURCE!, "utf8")) as { chunks: TextChunk[] };
  const { plans } = JSON.parse(await readFile(process.env.MARGIN_STEP_PLANS!, "utf8")) as { plans: LearningPlan[] };
  const output = process.env.MARGIN_STEP_OUTPUT!;
  if (!output) throw Error("Private output checkpoint required");
  const index = Number(process.env.MARGIN_STEP_INDEX || 1);
  const chunk = chunks[index];
  const part = summaryPassages(chunk.text, chunk.startPage, chunk.endPage)[0];
  const blueprint = objectiveBlueprint(plans)[index];
  const signature = createHash("sha256").update(JSON.stringify({ chunk, plan: plans[index], rule: STUDY_RULE_VERSION })).digest("hex");
  type State = { signature: string; calls: number; models: string[]; checkpoints: Record<string, CheckpointValue>;
    summary?: string; questions?: QuizQuestionV2[]; events: unknown[] };
  let state: State = { signature, calls: 0, models: [], checkpoints: {}, events: [] };
  try { const saved = JSON.parse(await readFile(output, "utf8")); if (saved.signature === signature) state = saved; } catch { /* first run */ }
  const persist = () => writeFile(output, JSON.stringify(state, null, 2));
  const reserve = async () => { if (state.calls >= 24) throw Error("Sample evaluation budget reached"); state.calls++; await persist(); };
  const model = (name: string) => { if (!state.models.includes(name)) state.models.push(name); };
  const run = async <T>(operation: () => Promise<T>): Promise<T> => {
    for (let request = 0; request < 20; request++) {
      const started = Date.now();
      try { return await withGenerationCheckpoints({ read: async (key) => state.checkpoints[key] || null,
        write: async (key, value) => { state.checkpoints[key] = value; await persist(); } }, operation); }
      catch (error) {
        const continuing = error instanceof GenerationContinuation ||
          !!(error && typeof error === "object" && "status" in error && error.status === 503);
        state.events.push({ request, elapsedMs: Date.now() - started, calls: state.calls, continuing,
          reason: error instanceof Error ? error.message : "failure" });
        await persist();
        if (!continuing) throw error;
      }
    }
    throw Error("Sample did not finish within bounded requests");
  };
  if (process.env.MARGIN_STEP_KIND !== "quiz" && !state.summary) {
    state.summary = await run(() => summarizeChunk(part.text, part.start, part.end, "medical", chunk.section!.title,
      chunk.section!.source, canonicalSummaryTarget(part.text.length), reserve, AbortSignal.timeout(240_000), [], model));
    await persist(); expect(state.summary.length).toBeGreaterThan(80);
  }
  if (process.env.MARGIN_STEP_KIND !== "summary" && !state.questions) {
    state.questions = await run(() => generateChunkQuestions(chunk.text, blueprint.formats.slice(0, 2), blueprint.families.slice(0, 2),
      chunk.startPage, chunk.endPage, chunk.section!.title, reserve, AbortSignal.timeout(240_000), [], model,
      blueprint.objectives.slice(0, 2)));
    await persist(); expect(state.questions).toHaveLength(2);
  }
}, 3_600_000);
