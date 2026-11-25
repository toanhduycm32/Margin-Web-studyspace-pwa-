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

export function ownerEmail(): string {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(503, "OWNER_EMAIL is not configured.");
  }
  return email;
}

export function googleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new AppError(503, "Google OAuth is not configured.");
  return { clientId, clientSecret, redirectUri: `${appOrigin()}/api/auth/callback` };
}

export function setupMissing(): string[] {
  const required = ["APP_ORIGIN", "OWNER_EMAIL", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
    "SESSION_SECRET", "NEXT_PUBLIC_GOOGLE_PICKER_API_KEY", "NEXT_PUBLIC_GOOGLE_APP_ID", "NVIDIA_API_KEY"];
  return required.filter((name) => !process.env[name]);
}
