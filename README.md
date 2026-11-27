# Margin — private Google Drive PDF reader and AI learning app

An iPhone-first web app for reading PDFs stored in your Google Drive. It opens the original PDF in a continuous reader, saves your reading position and learning resources in your Drive app data, and uses NVIDIA for whole-document summaries and quizzes.

Margin supports **multiple explicitly authorized Google accounts** at the same URL. Each person signs in independently and keeps PDFs, reading progress, summaries, quizzes, and usage records in their own Google Drive. There is no Supabase dependency or hosted database.

## What is implemented

- Google OAuth with a verified-email allowlist, independent encrypted HTTP-only sessions, and token refresh.
- Google Picker for selecting an existing PDF or uploading a new one to Drive.
- PDF library, in-app continuous scrolling, lazy page rendering, and saved reading position.
- Vietnamese whole-PDF learning: one educational summary standard, evidence-linked automatic assessment planning, varied theory/clinical questions, shuffled answer positions, exact-set scoring and saved attempts.
- Drive `appDataFolder` storage for library references, intermediate results, artifacts, attempts, and reading progress.
- Installable web app manifest and iPhone Home Screen icons.

PDF pages without extractable text are reported. The app does not perform OCR or interpret images and diagrams. It refuses to save a partial result when the PDF exceeds its processing limit (5,000 pages, 80 segments, or 250 MB). It sends extracted PDF text to the configured NVIDIA API when you request a summary or quiz. The interface offers “Tóm tắt tài liệu” and “Tạo trắc nghiệm”, with explicit regeneration. Summary length grows with source content and preserves real lesson/subsection headings. Question count follows source-backed learning objectives across every readable section, with a majority of multiple-correct items. Banks use recoverable batches of two, with separately checkpointed drafting and review; safety envelopes currently allow 800 items, 80 per segment, and the byte limits described in ARCHITECTURE.md. These are processing ceilings, not promised question counts or proof of educational completeness. Model review checks both summaries and answer sets; specialist review remains necessary for clinical accuracy.

Each PDF has one current summary and one current quiz. A new accepted result replaces only its own type after successful storage. Failed generation leaves the accepted resource available. Immutable operation ordering prevents a delayed older job from winning; cleanup is scoped to the superseded resource and its own quiz attempts. Drive is not a transactional database; see the recovery limitations in ARCHITECTURE.md.

## Run locally on Windows

1. Install Node.js 22.13 or newer and pnpm.
2. From this folder, run `pnpm install`.
3. Fill the empty values in **this folder's `.env.local`**. Set `AUTHORIZED_GOOGLE_EMAILS` to a comma-separated list of every allowed account. Do not send secrets in chat or commit this file. `.env.example` documents the variable names. Keep the existing `SESSION_SECRET` stable.
4. Run `pnpm dev`, then open `http://localhost:3000`.

| Variable | Value |
| --- | --- |
| `APP_ORIGIN` | `http://localhost:3000` locally; `https://margin-web-studyspace-pwa.vercel.app` in Vercel Production. No path or trailing slash. |
| `AUTHORIZED_GOOGLE_EMAILS` | Comma-separated, exact verified emails for every allowed user. Include the current owner and the second user. This takes precedence over `OWNER_EMAIL`. |
| `OWNER_EMAIL` | Deprecated single-user fallback if `AUTHORIZED_GOOGLE_EMAILS` is absent. Do not use it for the multi-user deployment. |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 **Web application** client ID. |
| `GOOGLE_CLIENT_SECRET` | Secret for that same Web application client. Server-side only. |
| `SESSION_SECRET` | Stable random base64 value representing at least 32 bytes. Already generated in local `.env.local`. Use the same value in production if you want existing sessions to survive a deployment change. |
| `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` | Google Picker browser API key. Public by design; restrict it to your site origins and Google Picker API. |
| `NEXT_PUBLIC_GOOGLE_APP_ID` | Numeric Google Cloud project **number** for Picker, not the project ID. |
| `NVIDIA_API_KEY` | NVIDIA API key. Server-side only. Reader works without it; summaries and quizzes do not. |
| `NVIDIA_MODEL` | Optional; primary model defaults to `mistralai/mistral-large-4-1t-a52b`. An old deployment still set to `nvidia/nemotron-3.5-lightning-30b-a3b` is treated as a legacy setting, so Mistral remains primary. Set this variable to the Mistral ID explicitly when editing production configuration. |
| `NVIDIA_FALLBACK_MODEL` | Optional; defaults to `nvidia/nemotron-3.5-lightning-30b-a3b` for temporary Mistral timeout/provider failure. |
| `AI_DAILY_CALL_LIMIT` | Optional per-user UTC-day model-call limit; default `200`, allowed `1`–`1000`. |
| `AI_PROCESS_CONCURRENCY` | Optional simultaneous model calls per Node process; default `4`, allowed `1`–`16`. One call per user is always enforced per process. |

The `NEXT_PUBLIC_` values are built into the browser bundle. Set them before `pnpm build` and rebuild after changing them.

## Google Cloud setup

1. Create/select a Google Cloud project. Enable **Google Drive API** and **Google Picker API**.
2. Configure the Google Auth Platform consent screen. Use an **External** audience unless your Google Workspace setup calls for Internal. While the app is in **Testing**, add **both actual Google emails** as test users. Keep the app's authorized domain and publishing status compliant with Google's console requirements. The application's own email allowlist remains required even if Google's consent screen is In production.
3. Add these scopes: `openid`, `email`, `https://www.googleapis.com/auth/drive.file`, and `https://www.googleapis.com/auth/drive.appdata`. The latter two allow access to PDFs selected with Picker and to this app's private Drive records.
4. Keep the existing **Web application** OAuth client. Under **Authorized JavaScript origins**, enter `http://localhost:3000` and `https://margin-web-studyspace-pwa.vercel.app`. Under **Authorized redirect URIs**, enter `http://localhost:3000/api/auth/callback` and `https://margin-web-studyspace-pwa.vercel.app/api/auth/callback`. Leave **Use this client for an AI-powered agent** off: NVIDIA writes study content but does not autonomously act through Google Workspace. No new OAuth client or scopes are needed for the second user.
5. Restrict the Picker API key to **Google Picker API**. For **Website restrictions**, include `http://localhost:3000`, `http://localhost:3000/*`, `https://margin-web-studyspace-pwa.vercel.app`, `https://margin-web-studyspace-pwa.vercel.app/*`, and `https://docs.google.com/*`. The Picker iframe needs the Google Docs referrer. Keep the numeric Google Cloud project number in `NEXT_PUBLIC_GOOGLE_APP_ID`.
6. Each authorized user opens Margin on their own device, selects **Kết nối Google Drive**, and approves the same scopes. Each user's Drive library is separate.

Google OAuth **External / Testing** refresh tokens can expire after seven days for these Drive scopes. For reliable long-term use, review Google's production consent and verification requirements in the console. If permission expires, reconnect in the app. [Google's scope classification](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) lists `drive.file` and `drive.appdata` as non-sensitive.

Official references: [OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Drive app data](https://developers.google.com/workspace/drive/api/guides/appdata), [Picker setup](https://developers.google.com/workspace/drive/picker/guides/web-picker).

## NVIDIA setup

Use the existing `NVIDIA_API_KEY` in `.env.local` and Vercel Production. Mistral Large 4 is the primary model, using its supported low/medium/high reasoning levels according to the task. The released model does not accept the preview-only `none` value. If it times out or has a temporary provider error, the server uses Nemotron as a bounded fallback and records the model(s) used in the saved artifact. Each provider call, including fallback and review, counts toward the user's daily limit. The browser never receives the key. A per-user Drive usage ledger and process-local concurrency limits reduce abuse. **These are not atomic limits across Vercel instances**; check whether your NVIDIA account offers a provider-enforced cap and add a Vercel Firewall rule for the public AI routes. See [MULTI_USER_ARCHITECTURE.md](MULTI_USER_ARCHITECTURE.md).

Evidence handling is integrated. Narrow, dated notes checked against Vietnamese Ministry of Health guidance and relevant ADA guidance are distinguished from live Europe PMC research abstracts. Only fixed public topics leave the server as search queries. The PDF remains the learning authority; outside evidence is labeled and cannot silently rewrite the source. A cited abstract or curated note does not establish that every clinical claim is current or verified. Do not process identifiable patient records.

## Deploy for iPhone access

The deployed origin is `https://margin-web-studyspace-pwa.vercel.app`; your PC need not stay on. Both authorized emails are configured. A real simultaneous two-account AI check still needs both users' interactive sessions.

1. This app is published as the root of its own Git repository. Keep `.env.local`, `node_modules`, and `.next` out of Git (already ignored). If deploying from the original larger workspace instead, set the hosting **Root Directory** to `pdf-reader-ai`.
2. In the existing Vercel project's **Settings → Environment Variables → Production**, keep the verified two-user `AUTHORIZED_GOOGLE_EMAILS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, Picker values, and NVIDIA key. Set/confirm `APP_ORIGIN=https://margin-web-studyspace-pwa.vercel.app` and set `NVIDIA_MODEL=mistralai/mistral-large-4-1t-a52b`; `NVIDIA_FALLBACK_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b` is optional. The code also migrates the old Nemotron `NVIDIA_MODEL` value to Mistral primary until you update this setting. `AI_DAILY_CALL_LIMIT=200` and `AI_PROCESS_CONCURRENCY=4` are optional explicit defaults. You may remove `OWNER_EMAIL` after the new allowlist is active.
3. Redeploy after changing Vercel environment variables; they do not change an existing deployment. An already-listed user can sign in again from another device without editing Vercel settings. To add a **new** user later, update the allowlist and redeploy; while Google consent is in Testing, add that user to Google's test-user list too.
   For an additional edge guard, open **Vercel project → Firewall → Configure → New Rule**: condition **Path starts with `/api/ai/`**, action **Rate limit, 60 requests per minute per IP, then return 429**; review and publish the rule. Check the Firewall overview after two real users test it, since two people behind one IP share that limit. The application allowlist and per-user Drive quota remain the primary access controls.
4. Test each account in an independent browser profile or device at the same HTTPS URL: connect, pick or upload a PDF, read, generate a short summary and quiz, reload saved resources, and confirm the other account cannot see them. Test both sessions at the same time.
5. On iPhone, open the HTTPS URL in Safari, tap **Share → Add to Home Screen**, enable **Open as Web App** when offered, and tap **Add**. [Apple's current instructions](https://support.apple.com/en-az/guide/iphone/iphea86e5236/26/ios/26) describe this flow.

The production bundle, origin, OAuth redirect, and unauthenticated library denial were checked, but simultaneous AI use has not yet been verified with two real Google accounts or on two physical iPhones; see [STATUS.md](STATUS.md). Each user's Drive data survives code deployments. Existing finished artifacts and attempts remain readable. New artifacts and attempts use schema 2; new intermediate maps use schema 3, and old map caches are deliberately not reused.

## Commands

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for data flow and limitations and [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md) for the supplied requirements.
