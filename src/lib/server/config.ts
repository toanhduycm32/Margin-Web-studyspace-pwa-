import { AppError } from "./errors";

export function appOrigin(): string {
  const raw = process.env.APP_ORIGIN;
  if (!raw) throw new AppError(503, "APP_ORIGIN is not configured.");
  let url: URL;
  try { url = new URL(raw); } catch { throw new AppError(503, "APP_ORIGIN is invalid."); }
  if (url.origin !== raw.replace(/\/$/, "") ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost"))) {
    throw new AppError(503, "APP_ORIGIN must be an HTTPS origin or http://localhost:3000.");
  }
  return url.origin;
}

export function authorizedEmails(): Set<string> {
  // OWNER_EMAIL keeps an existing single-user installation working until it is migrated.
  const raw = process.env.AUTHORIZED_GOOGLE_EMAILS ?? process.env.OWNER_EMAIL ?? "";
  const emails = raw.split(/[\n,]/).map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (!emails.length || emails.length > 100 || emails.some((email) =>
    !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email))) {
    throw new AppError(503, "AUTHORIZED_GOOGLE_EMAILS must list 1–100 valid email addresses.");
  }
  return new Set(emails);
}

export function isAuthorizedEmail(email: string): boolean {
  return authorizedEmails().has(email.trim().toLowerCase());
}

export function googleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new AppError(503, "Google OAuth is not configured.");
  return { clientId, clientSecret, redirectUri: `${appOrigin()}/api/auth/callback` };
}

export function setupMissing(): string[] {
  const required = ["APP_ORIGIN", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
    "SESSION_SECRET", "NEXT_PUBLIC_GOOGLE_PICKER_API_KEY", "NEXT_PUBLIC_GOOGLE_APP_ID", "NVIDIA_API_KEY"];
  const missing = required.filter((name) => !process.env[name]);
  try { authorizedEmails(); } catch { missing.push("AUTHORIZED_GOOGLE_EMAILS"); }
  return missing;
}
