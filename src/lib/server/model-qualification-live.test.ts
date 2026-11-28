import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { it, expect, vi } from "vitest";
import { summarizeChunk, generateChunkQuestions, planLearning, reviewSummary } from "./nvidia";
import { summaryPassages } from "./generation-input";
import { objectiveBlueprint, canonicalSummaryTarget } from "../shared/education";
import type { TextChunk } from "../client/extract";
import type { LearningPlan } from "../shared/types";
import { generateSectionQuestions, reviewSectionQuestions } from "./section-assessment";
import { sectionQuestionFormats } from "../shared/learning-workload";

// Explicitly opt-in, private diagnostic. Extends ONLY this test's provider deadline;
// does not imply that the same request duration fits a deployed Vercel function.
it.skipIf(!process.env.MARGIN_QUALIFY_OUTPUT)("qualifies complete model output without fallback", async () => {
  const output = process.env.MARGIN_QUALIFY_OUTPUT!;
  const input = process.env.MARGIN_QUALIFY_SOURCE || ".git/review-fixtures/vietnamese-extracted-18k.json";
  const plansFile = process.env.MARGIN_QUALIFY_PLANS || ".git/review-fixtures/vietnamese-18k-live.json";
  const { chunks } = JSON.parse(await readFile(input, "utf8")) as { chunks: TextChunk[] };
  const { plans } = JSON.parse(await readFile(plansFile, "utf8")) as { plans: LearningPlan[] };
  const index = Number(process.env.MARGIN_QUALIFY_INDEX || 1);
  const count = Number(process.env.MARGIN_QUALIFY_COUNT || 2);
  const kind = process.env.MARGIN_QUALIFY_KIND || "summary";
  const chunk = chunks[index];
  const part = process.env.MARGIN_QUALIFY_FULL_SECTION === "1"
    ? { text: chunk.text, start: chunk.startPage, end: chunk.endPage }
    : summaryPassages(chunk.text, chunk.startPage, chunk.endPage)[0];
  const model = process.env.MARGIN_QUALIFY_MODEL || "mistralai/mistral-large-4-1t-a52b";
  const deadline = Math.min(480_000, Number(process.env.MARGIN_QUALIFY_DEADLINE || 420_000));
  const operationStarted = Date.now();
  const record: Record<string, unknown> = { model, kind, index, count, started: new Date().toISOString(),
    sourceHash: createHash("sha256").update(chunk.text).digest("hex"), sourceCharacters: chunk.text.length,
    summaryCharacters: part.text.length, diagnosticDeadlineMs: deadline, calls: [] };
  record.implementationHashes = Object.fromEntries(await Promise.all([
    "src/lib/server/nvidia.ts", "src/lib/server/summary-review.ts", "src/lib/shared/education.ts",
    "src/lib/shared/study-rules.ts", "src/lib/server/generation-input.ts",
    "src/lib/server/section-assessment.ts", "src/lib/shared/learning-workload.ts",
  ].map(async (path) => [path, createHash("sha256").update(await readFile(path)).digest("hex")])));
  const calls = record.calls as Record<string, unknown>[];
  const replayFile = process.env.MARGIN_QUALIFY_REPLAY;
  const replay = replayFile ? JSON.parse(await readFile(replayFile, "utf8")) : null;
  if (replay && (replay.model !== model || replay.sourceHash !== record.sourceHash ||
      replay.kind !== kind || replay.index !== index || replay.count !== count)) throw Error("Replay scope mismatch");
  let replayed = 0;
  const replayCount = replay ? Math.min(replay.calls.length, Number(process.env.MARGIN_QUALIFY_REPLAY_CALLS || 1)) : 0;
  await writeFile(output, JSON.stringify(record, null, 2), { flag: "wx" });
  const save = () => writeFile(output, JSON.stringify(record, null, 2));
  const originalFetch = globalThis.fetch;
  vi.stubEnv("NVIDIA_MODEL", model);
  vi.stubEnv("NVIDIA_FALLBACK_MODEL", model);
  vi.stubGlobal("fetch", async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(url) !== "https://integrate.api.nvidia.com/v1/chat/completions") return originalFetch(url, init);
    const configuredCalls = Number(process.env.MARGIN_QUALIFY_MAX_CALLS || 8);
    const maxCalls = Number.isFinite(configuredCalls) ? Math.max(1, Math.min(8, Math.floor(configuredCalls))) : 8;
    if (calls.length >= maxCalls || Date.now() - operationStarted > 900_000) throw Error("Diagnostic operation budget exhausted");
    const body = JSON.parse(String(init?.body));
    if (body.model !== model) throw Error("Fallback prohibited during model qualification");
    body.stream = process.env.MARGIN_QUALIFY_STREAM === "1" || (kind !== "section" && process.env.MARGIN_QUALIFY_RUNTIME !== "1");
    if (replay && replayed < replayCount) {
      const prior = replay.calls[replayed];
      if (JSON.stringify(prior.request) !== JSON.stringify(body) || prior.finish !== "stop" || !prior.content) {
        throw Error("Replay must match the exact completed draft request");
      }
      replayed++;
      calls.push({ number: calls.length + 1, request: body, content: prior.content, finish: "stop", elapsedMs: 0,
        reusedFrom: replayFile, originalElapsedMs: prior.elapsedMs });
      await save();
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: prior.content } }] });
    }
    const started = Date.now();
    const call: Record<string, unknown> = { number: calls.length + 1, request: body,
      firstReasoningMs: null, firstContentMs: null, reasoningCharacters: 0, content: "", finish: null };
    calls.push(call);
    await save();
    try {
      const response = await originalFetch(url, { ...init, body: JSON.stringify(body),
        signal: AbortSignal.timeout(Math.min(deadline, Math.max(1, 900_000 - (Date.now() - operationStarted)))) });
      call.status = response.status; call.connectedMs = Date.now() - started;
      if (!response.ok) { call.error = (await response.text()).slice(0, 2000); return new Response("{}", { status: response.status }); }
      if (!body.stream) {
        const result = await response.json();
        call.usage = result.usage;
        call.content = result.choices?.[0]?.message?.content || "";
        call.finish = result.choices?.[0]?.finish_reason;
        call.reasoningCharacters = String(result.choices?.[0]?.message?.reasoning_content || "").length;
        return Response.json(result);
      }
      const reader = response.body!.getReader();
      const decoder = new TextDecoder(); let pending = "";
      const consume = (line: string) => {
        if (!line.startsWith("data:")) return;
        const data = line.slice(5).trim(); if (!data || data === "[DONE]") return;
        const event = JSON.parse(data); if (event.usage) call.usage = event.usage;
        const choice = event.choices?.[0]; if (!choice) return;
        const delta = choice.delta || {};
        const reasoning = delta.reasoning_content || delta.reasoning || "";
        if (reasoning) { call.firstReasoningMs ??= Date.now() - started; call.reasoningCharacters = Number(call.reasoningCharacters) + reasoning.length; }
        if (typeof delta.content === "string" && delta.content) { call.firstContentMs ??= Date.now() - started; call.content += delta.content; }
        if (choice.finish_reason) call.finish = choice.finish_reason;
      };
      while (true) { const part = await reader.read(); if (part.done) break;
        pending += decoder.decode(part.value, { stream: true }); const lines = pending.split("\n"); pending = lines.pop()!;
        for (const line of lines) consume(line);
      }
      pending += decoder.decode(); if (pending.trim()) consume(pending);
      if (!call.finish) throw Error("Stream ended without completion marker");
      return Response.json({ choices: [{ finish_reason: call.finish, message: { content: call.content } }] });
    } catch (error) { call.error = error instanceof Error ? `${error.name}: ${error.message}` : "unknown"; throw error; }
    finally { call.elapsedMs = Date.now() - started; await save();
      console.log("qualification_call", { number: call.number, status: call.status, elapsedMs: call.elapsedMs,
        firstReasoningMs: call.firstReasoningMs, firstContentMs: call.firstContentMs, finish: call.finish,
        contentCharacters: String(call.content).length, error: call.error }); }
  });
  try {
    const reserve = async () => {};
    if (kind === "section-audit") {
      const candidate = JSON.parse(await readFile(process.env.MARGIN_QUALIFY_CANDIDATE!, "utf8"));
      record.accepted = await reviewSectionQuestions(chunk.text, candidate.accepted, reserve);
      expect((record.accepted as { valid: boolean }).valid).toBe(process.env.MARGIN_QUALIFY_EXPECT_VALID === "1");
    } else if (kind === "section") {
      record.accepted = await generateSectionQuestions(chunk.text, sectionQuestionFormats(chunk.text),
        chunk.startPage, chunk.endPage, chunk.section!.title, reserve);
    } else if (kind === "plan") {
      record.accepted = await planLearning(chunk.text, chunk.section!.title, `s${index}`, reserve);
    } else if (kind === "summary-audit") {
      const candidate = JSON.parse(await readFile(process.env.MARGIN_QUALIFY_CANDIDATE!, "utf8"));
      record.accepted = await reviewSummary(part.text, candidate.accepted, reserve);
      expect((record.accepted as { valid: boolean }).valid).toBe(process.env.MARGIN_QUALIFY_EXPECT_VALID === "1");
    } else if (kind === "summary") {
      record.accepted = await summarizeChunk(part.text, part.start, part.end, "medical", chunk.section!.title,
        chunk.section!.source, canonicalSummaryTarget(part.text.length), reserve);
    } else {
      const blueprint = objectiveBlueprint(plans)[index];
      const offset = Number(process.env.MARGIN_QUALIFY_OFFSET || 0);
      record.accepted = await generateChunkQuestions(chunk.text, blueprint.formats.slice(offset, offset + count),
        blueprint.families.slice(offset, offset + count), chunk.startPage, chunk.endPage, chunk.section!.title,
        reserve, undefined, [], undefined, blueprint.objectives.slice(offset, offset + count));
    }
    record.acceptedByApplication = true;
    expect(record.accepted).toBeTruthy();
  } catch (error) { record.error = error instanceof Error ? error.message : "unknown"; throw error; }
  finally { record.elapsedMs = Date.now() - operationStarted; await save(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
}, 960_000);
