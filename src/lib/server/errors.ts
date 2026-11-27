export class AppError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

export function failure(error: unknown): Response {
  const status = error instanceof AppError ? error.status : 502;
  const message = error instanceof AppError ? error.message : "Request failed. Please try again.";
  return Response.json({ error: vietnameseMessage(message, status),
    ...(error instanceof AppError && error.code ? { code: error.code } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
}
import { vietnameseMessage } from "@/lib/shared/messages";
