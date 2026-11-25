import { AppError } from "./errors";

export async function readJsonBody<T>(request: Request, maximumBytes: number): Promise<T> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > maximumBytes) throw new AppError(413, "Request body is too large.");
  if (!request.body) throw new AppError(400, "Request body is missing.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new AppError(413, "Request body is too large.");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(body)) as T; }
  catch { throw new AppError(400, "Request body must be valid JSON."); }
}
