export class AppError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function failure(error: unknown): Response {
  const status = error instanceof AppError ? error.status : 502;
  const message = error instanceof Error ? error.message : "Request failed.";
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
