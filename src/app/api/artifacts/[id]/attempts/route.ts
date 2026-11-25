import { withSession } from "@/lib/server/session";
import { AppError } from "@/lib/server/errors";
import { getArtifact, listAttempts, saveAttempt } from "@/lib/server/store";
import { normalizedAnswers, scoreQuiz } from "@/lib/shared/quiz";
import type { QuizQuestion } from "@/lib/shared/types";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return withSession(request, async (session) => {
    const { id } = await context.params;
    const artifact = await getArtifact(session.accessToken, id);
    if (artifact.kind !== "quiz") throw new AppError(400, "This resource is not a quiz.");
    return Response.json({ attempts: await listAttempts(session.accessToken, id) });
  });
}

export async function POST(request: Request, context: Context) {
  return withSession(request, async (session) => {
    const { id } = await context.params;
    const artifact = await getArtifact(session.accessToken, id);
    if (artifact.kind !== "quiz") throw new AppError(400, "This resource is not a quiz.");
    const body = await request.json().catch(() => null) as { answers?: unknown } | null;
    const questions = (artifact.payload as { questions: QuizQuestion[] }).questions;
    const answers = body?.answers;
    if (!Array.isArray(answers)) throw new AppError(400, "Answer every question first.");
    let score: number; let selected: number[][];
    try { selected = normalizedAnswers(questions, answers); score = scoreQuiz(questions, selected); }
    catch (error) { throw new AppError(400, error instanceof Error ? error.message : "Invalid answers."); }
    return Response.json({ attempt: await saveAttempt(session.accessToken, {
      schema: 2, artifactId: id, documentId: artifact.documentId, answers: selected, score,
      questionCount: questions.length,
    }) });
  });
}
