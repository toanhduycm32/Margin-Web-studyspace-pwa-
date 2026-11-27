export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...options, headers, credentials: "same-origin", cache: "no-store" });
  const data = await response.json().catch(() => ({})) as T & { error?: string; code?: string };
  if (!response.ok) throw new ApiError(response.status, vietnameseMessage(data.error || "Request failed.", response.status), data.code);
  return data;
}
import { vietnameseMessage } from "@/lib/shared/messages";
