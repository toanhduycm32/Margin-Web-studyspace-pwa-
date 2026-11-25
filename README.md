# Margin — personal PDF reader and AI learning app

An iPhone-first web app for reading PDFs stored in your Google Drive. It opens the original PDF in a continuous reader, saves your reading position and learning resources in your Drive app data, and uses NVIDIA for whole-document summaries and quizzes.

The app is a **personal, single-account** project. It has no Supabase dependency or hosted database. The Google account whose verified email matches `OWNER_EMAIL` is the only account allowed to use it.

## What is implemented

- Google OAuth, restricted to `OWNER_EMAIL`, with encrypted HTTP-only session cookies and token refresh.
- Google Picker for selecting an existing PDF or uploading a new one to Drive.
- PDF library, in-app continuous scrolling, lazy page rendering, and saved reading position.
- Whole-PDF text extraction, chunk processing, summary, multiple-choice quiz, scoring, and saved attempts.
- Drive `appDataFolder` storage for library references, intermediate results, artifacts, attempts, and reading progress.
- Installable web app manifest and iPhone Home Screen icons.

PDF pages without extractable text are reported. The app does not perform OCR or interpret images and diagrams. It refuses to save a partial result when the PDF exceeds its processing limit (5,000 pages, 80 chunks, or 250 MB). It sends extracted PDF text to the configured NVIDIA API when you request a summary or quiz.

## Run locally on Windows

1. Install Node.js 22.13 or newer and pnpm.
2. From this folder, run `pnpm install`.
3. Fill the empty values in **this folder's `.env.local`**. Do not send secrets in chat or commit that file. `.env.example` documents the variable names. `SESSION_SECRET` is already randomly generated in the local file; keep that value stable.
4. Run `pnpm dev`, then open `http://localhost:3000`.

| Variable | Value |
| --- | --- |
| `APP_ORIGIN` | `http://localhost:3000` locally; the exact HTTPS site origin after deployment, without a path or trailing slash. |
| `OWNER_EMAIL` | The one Google email allowed to connect. |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 **Web application** client ID. |
| `GOOGLE_CLIENT_SECRET` | Secret for that same Web application client. Server-side only. |
| `SESSION_SECRET` | Stable random base64 value representing at least 32 bytes. Already generated in local `.env.local`. Use the same value in production if you want existing sessions to survive a deployment change. |
| `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` | Google Picker browser API key. Public by design; restrict it to your site origins and Google Picker API. |
| `NEXT_PUBLIC_GOOGLE_APP_ID` | Numeric Google Cloud project **number** for Picker, not the project ID. |
| `NVIDIA_API_KEY` | NVIDIA API key. Server-side only. Reader works without it; summaries and quizzes do not. |
| `NVIDIA_MODEL` | Optional; defaults to `nvidia/nemotron-3.5-lightning-30b-a3b`. |

The `NEXT_PUBLIC_` values are built into the browser bundle. Set them before `pnpm build` and rebuild after changing them.

## Google Cloud setup

1. Create/select a Google Cloud project. Enable **Google Drive API** and **Google Picker API**.
2. Configure the Google Auth Platform consent screen. Use an **External** audience unless your Google Workspace setup calls for Internal. Add your email as a test user while the app is in Testing. Set the app's authorized domains as Google requires for your production domain.
3. Add these scopes: `openid`, `email`, `https://www.googleapis.com/auth/drive.file`, and `https://www.googleapis.com/auth/drive.appdata`. The latter two allow access to PDFs selected with Picker and to this app's private Drive records.
4. Create an OAuth client of type **Web application**. A useful console-only name is `Margin Web (studyspace-pwa)`. For local development, add `http://localhost:3000` under **Authorized JavaScript origins** and `http://localhost:3000/api/auth/callback` under **Authorized redirect URIs**. Leave **Use this client for an AI-powered agent** off: this app uses the Google Drive REST API and Picker, while NVIDIA generates study materials rather than autonomously acting through Google Workspace. Copy the resulting client ID and client secret to this folder's `.env.local`.
5. No production URL is configured in this repository yet. After a deployment gives you a final HTTPS origin, add that exact origin under **Authorized JavaScript origins** and its exact `/api/auth/callback` URL under **Authorized redirect URIs**. Set `APP_ORIGIN` to that origin on the host. Do not enter a placeholder production URL in Google Cloud.
6. Enable **Google Picker API** as well as Drive API. Create a Google API key for Picker. Restrict it to **Google Picker API** and website referrers for your local origin and, when known, your production origin. Picker's iframe also needs `https://docs.google.com/*` in website restrictions. Put the key and the project's numeric project number (not its text project ID) in `.env.local`.
7. Restart `pnpm dev`, open the app, select **Continue with Google**, and approve the requested scopes with the account matching `OWNER_EMAIL`.

Google OAuth **External / Testing** refresh tokens can expire after seven days. For reliable long-term use, complete Google's requirements for a production consent screen. The scopes requested here may require Google verification; check the Cloud Console's actual status before relying on unattended access. If permission expires, reconnect in the app.

Official references: [OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Drive app data](https://developers.google.com/workspace/drive/api/guides/appdata), [Picker setup](https://developers.google.com/workspace/drive/picker/guides/web-picker).

## NVIDIA setup

Create an API key in your NVIDIA account and set `NVIDIA_API_KEY` in `.env.local`. The server calls NVIDIA's Chat Completions endpoint with reasoning enabled; the browser never receives this key. Processing cost and rate limits depend on your NVIDIA account and selected model. The initial model is the configured `NVIDIA_MODEL`.

## Deploy for iPhone access

The app requires a hosted Next.js environment with HTTPS; your PC need not stay on. Vercel is a straightforward option, though it is not a required data service.

1. This app is published as the root of its own Git repository. Keep `.env.local`, `node_modules`, and `.next` out of Git (already ignored). If deploying from the original larger workspace instead, set the hosting **Root Directory** to `pdf-reader-ai`.
2. Create a Next.js project on the host. Set all environment variables from the table above for the production environment. Set `APP_ORIGIN` to the final HTTPS origin. Use a stable `SESSION_SECRET`.
3. Add that origin and `/api/auth/callback` redirect URI to the Google OAuth client. Add the origin to the Picker key referrer restrictions. Build and deploy.
4. Test Google connection, picking/uploading a PDF, reading, summary, quiz, saved resources, and reconnecting after a browser restart on the deployed URL.
5. On iPhone, open the HTTPS URL in Safari, tap **Share → Add to Home Screen**, enable **Open as Web App** when offered, and tap **Add**. [Apple's current instructions](https://support.apple.com/en-az/guide/iphone/iphea86e5236/26/ios/26) describe this flow.

No deployment or physical iPhone test has been performed yet; see [STATUS.md](STATUS.md). Drive data survives code deployments because it is stored in the owner's Drive. Maintain compatibility with the `schema` fields in stored records when changing future versions.

## Commands

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for data flow and limitations and [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md) for the supplied requirements.
