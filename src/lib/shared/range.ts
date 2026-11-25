export type RangePlan = { range: string } | { error: string; status: number };

export function planPdfRange(requested: string | null, size: number): RangePlan {
  if (!Number.isSafeInteger(size) || size < 1) return { error: "PDF size is unavailable.", status: 409 };
  if (!requested) return { error: "A byte range is required to read this PDF.", status: 416 };
  const match = /^bytes=(\d+)-(\d*)$/.exec(requested);
  if (!match) return { error: "Unsupported byte range.", status: 416 };
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) {
    return { error: "Invalid byte range.", status: 416 };
  }
  return { range: `bytes=${start}-${Math.min(end, size - 1, start + 2 * 1024 * 1024 - 1)}` };
}
