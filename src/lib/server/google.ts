import { randomBytes } from "node:crypto";
import type { DriveFile } from "@/lib/shared/types";
import { googleCredentials } from "./config";
import { AppError } from "./errors";

export const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const APP_DATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
export const GOOGLE_SCOPES = `openid email ${DRIVE_FILE_SCOPE} ${APP_DATA_SCOPE}`;

type TokenResult = { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string };
export type GoogleTokens = { accessToken: string; refreshToken: string; expiresAt: number };
export type GoogleIdentity = { sub: string; email: string; email_verified: boolean };

export function authorizationUrl(state: string): string {
  const { clientId, redirectUri } = googleCredentials();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  for (const [key, value] of Object.entries({ client_id: clientId, redirect_uri: redirectUri,
    response_type: "code", scope: GOOGLE_SCOPES, access_type: "offline", prompt: "consent", state })) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResult> {
  const { clientId, clientSecret } = googleCredentials();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
    signal: AbortSignal.timeout(20_000), cache: "no-store",
  });
  const data = await response.json() as TokenResult;
  if (!response.ok || !data.access_token) {
    if (data.error === "invalid_grant") throw new AppError(401, "Google permission expired. Connect again.");
    throw new AppError(502, "Google authorization failed. Try connecting again.");
  }
  return data;
}

export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const token = await tokenRequest({ code, redirect_uri: googleCredentials().redirectUri, grant_type: "authorization_code" });
  const scopes = (token.scope || "").split(" ");
  if (!token.refresh_token || !scopes.includes(DRIVE_FILE_SCOPE) || !scopes.includes(APP_DATA_SCOPE)) {
    throw new AppError(403, "Google did not grant reusable Drive access. Connect again and approve both Drive permissions.");
  }
  return { accessToken: token.access_token!, refreshToken: token.refresh_token,
    expiresAt: Date.now() + Math.max(60, (token.expires_in || 3600) - 60) * 1000 };
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const token = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
  return { accessToken: token.access_token!, refreshToken: token.refresh_token || refreshToken,
    expiresAt: Date.now() + Math.max(60, (token.expires_in || 3600) - 60) * 1000 };
}

export async function googleIdentity(accessToken: string): Promise<GoogleIdentity> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new AppError(502, "Could not verify Google account.");
  const identity = await response.json() as GoogleIdentity;
  if (!identity.sub || !identity.email || identity.email_verified !== true) {
    throw new AppError(403, "A verified Google email is required.");
  }
  return identity;
}

export async function revokeGoogle(refreshToken: string): Promise<void> {
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: refreshToken }), signal: AbortSignal.timeout(15_000), cache: "no-store",
  });
  if (!response.ok && response.status !== 400) throw new AppError(502, "Google did not confirm disconnection. Try again.");
}

export async function driveFetch(accessToken: string, url: string | URL, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(url, { ...options, headers, cache: "no-store", signal: options.signal || AbortSignal.timeout(30_000) });
  if (response.status === 401) throw new AppError(401, "Google permission expired. Connect again.");
  if (response.status === 403) throw new AppError(403, "Google Drive access was denied for this file.");
  if (response.status === 404) throw new AppError(404, "Google Drive file was not found.");
  if (!response.ok) throw new AppError(502, `Google Drive request failed (${response.status}).`);
  return response;
}

export async function driveFile(accessToken: string, id: string): Promise<DriveFile> {
  if (!/^[A-Za-z0-9_-]{8,160}$/.test(id)) throw new AppError(400, "Invalid Drive file ID.");
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`);
  url.searchParams.set("fields", "id,name,mimeType,size,md5Checksum,version,modifiedTime,capabilities(canDownload)");
  return driveFetch(accessToken, url).then((response) => response.json() as Promise<DriveFile>);
}

export type AppDataMeta = {
  id: string; name: string; description?: string; modifiedTime?: string;
  appProperties?: Record<string, string>;
};

function quote(value: string): string { return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`; }

export async function listAppData(accessToken: string, filters: { kind?: string; name?: string; documentId?: string; artifactId?: string; pageToken?: string; pageSize?: number; orderBy?: string } = {}) {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("spaces", "appDataFolder");
  const clauses = ["trashed = false", "appProperties has { key='app' and value='margin-v1' }"];
  if (filters.kind) clauses.push(`appProperties has { key='kind' and value=${quote(filters.kind)} }`);
  if (filters.documentId) clauses.push(`appProperties has { key='documentId' and value=${quote(filters.documentId)} }`);
  if (filters.artifactId) clauses.push(`appProperties has { key='artifactId' and value=${quote(filters.artifactId)} }`);
  if (filters.name) clauses.push(`name = ${quote(filters.name)}`);
  url.searchParams.set("q", clauses.join(" and "));
  url.searchParams.set("fields", "nextPageToken,files(id,name,description,modifiedTime,appProperties)");
  url.searchParams.set("pageSize", String(Math.min(1000, Math.max(1, filters.pageSize || 100))));
  if (filters.orderBy) url.searchParams.set("orderBy", filters.orderBy);
  if (filters.pageToken) url.searchParams.set("pageToken", filters.pageToken);
  const response = await driveFetch(accessToken, url);
  return response.json() as Promise<{ nextPageToken?: string; files?: AppDataMeta[] }>;
}

export async function findAppData(accessToken: string, name: string): Promise<AppDataMeta | null> {
  const result = await listAppData(accessToken, { name, pageSize: 2 });
  return result.files?.[0] || null;
}

export async function readAppData<T>(accessToken: string, id: string): Promise<T> {
  if (!/^[A-Za-z0-9_-]{8,160}$/.test(id)) throw new AppError(400, "Invalid data record ID.");
  const response = await driveFetch(accessToken, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`);
  const declared = Number(response.headers.get("content-length"));
  if (declared > 1_000_000) throw new AppError(413, "Stored learning record is too large.");
  const text = await response.text();
  if (text.length > 1_000_000) throw new AppError(413, "Stored learning record is too large.");
  try { return JSON.parse(text) as T; }
  catch { throw new AppError(502, "Stored learning record is damaged."); }
}

export async function createAppData(accessToken: string, name: string, value: unknown,
  properties: Record<string, string>, description = ""): Promise<AppDataMeta> {
  const metadata = { name, mimeType: "application/json", parents: ["appDataFolder"],
    description: description.slice(0, 200), appProperties: { app: "margin-v1", ...properties } };
  const boundary = `margin_${randomBytes(12).toString("hex")}`;
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(value)}\r\n--${boundary}--`;
  if (Buffer.byteLength(body) > 1_000_000) throw new AppError(413, "Learning record is too large.");
  const url = new URL("https://www.googleapis.com/upload/drive/v3/files");
  url.searchParams.set("uploadType", "multipart");
  url.searchParams.set("fields", "id,name,description,modifiedTime,appProperties");
  const response = await driveFetch(accessToken, url, { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body, signal: AbortSignal.timeout(30_000) });
  return response.json() as Promise<AppDataMeta>;
}

export async function updateAppData(accessToken: string, id: string, value: unknown): Promise<void> {
  if (!/^[A-Za-z0-9_-]{8,160}$/.test(id)) throw new AppError(400, "Invalid data record ID.");
  const body = JSON.stringify(value);
  if (Buffer.byteLength(body) > 1_000_000) throw new AppError(413, "Learning record is too large.");
  await driveFetch(accessToken, `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(id)}?uploadType=media`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(30_000),
  });
}
