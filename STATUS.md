# Build status — 2026-11-24

## 2026-11-25 multi-user architecture enhancement

Target: standalone `pdf-reader-ai` repository on `main`; user-requested replacement of single-owner access with simultaneous independent Google users. The original project workflow v4.64, current handoff, app guidance, checkpoint, and affected source were read before modification. `PROJECT_HANDOFF.md` now notes that the newer multi-user request supersedes its single-owner passages.

Implemented: `AUTHORIZED_GOOGLE_EMAILS` exact verified-email allowlist (with `OWNER_EMAIL` fallback for old deployments); a separate encrypted session on each browser, allowlist recheck per protected request, and 30-day absolute session expiry. The OAuth callback denies and revokes an unlisted identity. Drive calls continue to use only the current session's access token. New signed chunk maps use schema 2 and include Google `sub`; old schema 1 intermediate maps are ignored while finished artifacts remain readable. Non-cached NVIDIA requests, including retries, reserve usage in the requesting user's Drive before inference. Defaults are 200 calls per user per UTC day, one active AI operation per user and four per process. The AI routes now enforce streamed body limits even without `Content-Length`; unexpected server exceptions return generic messages. UI and setup/deployment docs now describe independent private libraries and the actual Vercel origin. The ignored local `.env.local` has the current owner in `AUTHORIZED_GOOGLE_EMAILS`; the second email is intentionally pending user entry.

Verification: TypeScript typecheck passed; 33 tests in 13 files passed, including two simultaneous simulated OAuth/cookie/Drive sessions, cross-account artifact denial, separate PDF verification cache entries for two tokens, tenant-bound map rejection, allowlist removal, old-session rejection, per-account AI quota/concurrency, model retry accounting, and bounded streamed requests. Production build passed. The source scan found no configured Google client secret, session secret, Picker key, or NVIDIA key in files selected for Git. The existing production origin `https://margin-web-studyspace-pwa.vercel.app/` returned HTTP 200; its current `/api/config` reported no missing values, and `/api/auth/start` used the exact production callback and expected four scopes. These live checks were against the previously deployed version, not a two-user run. A separate local production-server smoke on port 3001 was attempted but automatic approval review rejected starting the process; no new local runtime result is claimed.

Outstanding: A second real Google email has not been supplied; the user will enter it later. Add both emails to Vercel `AUTHORIZED_GOOGLE_EMAILS` and to Google OAuth test users if the consent screen is still in Testing, then redeploy. Two real Google accounts in independent browser sessions and concurrent PDF/AI operations remain unverified. The Drive quota is best effort across Vercel instances and is not a hard global cost cap; see `MULTI_USER_ARCHITECTURE.md`. No Vercel or Google Cloud setting was changed in this source-only task.

## 2026-11-25 quality pass and GitHub handoff

The quality pass preserved Google Drive persistence, owner-restricted OAuth, continuous original-PDF reading, whole-PDF summary/quiz processing, and NVIDIA reasoning. It corrected text line preservation and bounded extraction memory, keyed reader state by document ID, memoized PDF page surfaces, and formatted summary structure safely. `pnpm typecheck`, 21 tests in 9 files, and `pnpm build` passed. The source scan found no locally configured secrets in the intended Git files. See `QUALITY_REVIEW_2026-11-25.md` for findings, evidence, and outstanding real-service/device checks. The standalone app repository was pushed to `toanhduycm32/Margin-Web-studyspace-pwa-` on `main`, beginning with commit `f2703b5`; local `.env.local`, build output, dependencies, and unrelated parent-project changes were excluded. The existing localhost server was not restarted because automatic command review rejected stopping its process; a manual restart is required to see this build on port 3000.

## Outcome

**Partial milestone.** The new application source is in this folder. The previous `studyspace-ai` folder was moved out of the project to a full recovery backup at `C:\Users\ADMIN\.codex\backups\studyspace-ai-v3-full-20261124-24f8cf88`. A separate SHA-256-verified 51-file source/config snapshot is at `C:\Users\ADMIN\.codex\backups\studyspace-ai-v3-20261124-24f8cf88`. The original app folder no longer occupies the project workspace. Direct recursive deletion was rejected by automatic approval review, so recovery copies were preserved outside the project. Unrelated `AI_SYSTEM` work was not modified for this task.

## Implemented

- Personal Google OAuth connection and owner-email restriction; encrypted session and token refresh.
- Drive PDF Picker integration, library references, authenticated PDF Range proxy, and Drive app data persistence.
- Continuous PDF reader with lazy page rendering, reading position, whole-document AI actions, saved summaries and quizzes, and quiz scoring/attempt history.
- NVIDIA API integration with reasoning parameters, chunk recovery, full page-range validation, structured quiz checks.
- PWA manifest, icons, safe environment template, and setup/deployment docs.
- No Supabase code, dependency, or environment variable in the new app.

## Verification

- TypeScript typecheck: passed.
- Vitest: 17 tests in 8 files passed, including extraction from a three-page PDF and short-text page handling.
- Next.js production build: passed after the final code changes.
- Local production HTTP smoke: page, manifest, icons, PDF worker, and config endpoint returned 200; protected endpoints returned 401 without a session. OAuth callback failure path returned a 302 after correction.
- 390×844 browser viewport: setup screen rendered without horizontal overflow. Authenticated reader and library visual QA still require configured services.
- Old source/config snapshot: 51 pairwise SHA-256 hashes verified.
- NVIDIA credential: copied into the ignored local `.env.local` from the old app's `.env.example` after the different value in the old `.env.local` returned HTTP 401. The copied value returned HTTP 200 with a reasoning-enabled request and nonempty final content. This verifies credential/model access, not a whole-PDF summary or quiz.
- Local app config endpoint now sees NVIDIA as configured; Google client and owner email remain missing. Git confirms `.env.local` is ignored.
- OAuth configuration audit: code requests `openid email https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata`; the server callback is `${APP_ORIGIN}/api/auth/callback`. Local scripts now pin Next.js to port 3000, and the OAuth test asserts the exact local redirect, scope list, and offline-access request. Typecheck, 17 tests, and production build passed after this change. No production deployment URL or Vercel project metadata is present in this app.
- User supplied a new Google OAuth Web client ID and secret; both were written to the Git-ignored local `.env.local` without printing their values. `NEXT_PUBLIC_GOOGLE_APP_ID` was set to the numeric project number derived from the ID prefix. A token-endpoint probe with an intentionally invalid authorization code returned `invalid_grant` rather than `invalid_client`, so Google accepted the client credential pair for that request; interactive OAuth and Drive access remain unverified.
- The owner confirmed the Google email, which is now in local `OWNER_EMAIL`. The production app's `/api/config` reports only `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` missing. `/api/auth/start` returns HTTP 200 with the exact local callback, all four scopes, and offline access. The home screen now permits Google sign-in before Picker is configured; PDF-add controls are disabled with an explanatory message until the Picker key is set. A 390×844 browser check showed the signed-out screen and no horizontal overflow. Typecheck, 17 tests, and production build passed after this change.
- A Google authorization-page GET returned HTTP 200 without `redirect_uri_mismatch` or `invalid_client` markers. This does not establish successful user consent or callback completion.
- 2026-11-25 live check: the owner completed Google's consent flow in the local in-app browser. The app returned to `http://localhost:3000/`, displayed the owner's account and `Google Drive connected.`, and rendered the authenticated library. This verifies interactive OAuth callback and session creation for that account. Local production server was restarted as a detached process; port 3000 was listening and the home page returned HTTP 200. The Picker API key is still blank, so adding a PDF remains disabled.
- 2026-11-25 Picker check: `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` is now present in the ignored `.env.local`. Rebuilt the production app and restarted the detached server so the public client configuration was refreshed. `/api/config` reports no missing values, `/` returns HTTP 200, Add PDF is enabled, and Google Picker opens and lists the owner's actual Drive PDFs. Closed Picker without selecting or importing a document. Key validity is demonstrated for this local origin; PDF import and reading remain unverified.
- 2026-11-25 PDF reader repair: reproduced `Invalid PDF structure` in Chrome with the owner's imported 354-page Design Patterns PDF. The original file proxy returned only the first 1 MiB as a 206 response to PDF.js's initial request without a `Range` header; PDF.js treated it as incomplete PDF input. The reader now uses `PDFDataRangeTransport` with explicit 1 MiB byte requests, and the proxy requires an exact range and validates Drive's byte count, content range, and PDF header. A 60-second, bounded in-memory verification cache avoids repeated Drive metadata checks for adjacent ranges. The production app was rebuilt and restarted. Typecheck, 19 tests including a multi-range PDF.js integration test, and build passed. In the owner's Chrome session, the same Drive PDF rendered as 354 pages without the structure error; pages 1–4 were visually inspected while scrolling continuously. This verifies local import and reading for this file. A measured iPhone performance baseline remains outstanding.

## Still to verify with real services and devices

- Drive upload, artifact persistence, and refresh/reconnect behavior. Interactive Google OAuth consent, owner account sign-in, one Drive import, and PDF streaming/reading are now verified locally.
- A real whole-PDF NVIDIA summary and quiz, including human review of factual quality.
- Large-PDF performance, deployed HTTPS URL, and physical iPhone Home Screen flow.

The local `.env.local` has a generated `SESSION_SECRET`, a working NVIDIA key, Google OAuth client ID and secret, the Picker API key and project number, and the owner's email. Interactive OAuth and Picker were verified locally. Do not paste further secrets into chat. The previously pasted Google client secret should be rotated after setup and replaced in `.env.local`. The old backup's `.env.example` contains a real NVIDIA key; keep that backup private and rotate the key if it was ever published.

## Known limits

- Text extraction only; no OCR or visual understanding of image-only pages.
- Maximum 250 MB, 5,000 pages, and 80 chunks; browser memory may limit practical size further.
- No offline PDF reading, service worker, or automatic migration framework yet.
- Google app data JSON records are schema v1. Future changes should preserve old records and migrate deliberately.
