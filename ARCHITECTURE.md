# Architecture and operating limits

## Data flow

```text
iPhone / browser
  → Next.js UI and authenticated API
  → Google OAuth / Drive API
      ↳ original PDF stays in Google Drive
      ↳ appDataFolder holds this app's JSON records
  → NVIDIA API for requested AI operations
```

The browser gets a short-lived Google access token only when opening Google Picker. The Google client secret, refresh token, and NVIDIA key stay on the server side; the refresh token is held in an encrypted, HTTP-only cookie on each user's device. The OAuth callback requires a verified Google email on `AUTHORIZED_GOOGLE_EMAILS`; every protected request rechecks the allowlist. The verified Google `sub` is the stable tenant identifier. Sessions have an absolute 30-day limit. The app checks the request origin for state-changing calls. Stored PDFs are fetched through an authenticated, bounded HTTP Range proxy so PDF.js can render pages without exposing the source URL or a long-lived credential.

## Storage

The PDF remains at its original Drive file ID. A small reference record, reading position, intermediate chunk map, summary or quiz, quiz attempts, and AI usage reservations are JSON files in **that user's own** Drive `appDataFolder`. Each API call uses the access token from that user's session. The records retain the `margin-v1` app marker. Documents, artifacts, and attempts remain schema 1; new intermediate maps use schema 2 and are signed with the Google `sub` embedded. Old schema 1 maps are left in Drive but are not reused. Generated artifacts are immutable; repeated runs create new artifacts. An interrupted AI run can reuse that user's saved signed chunk maps for the same Drive MD5 and extracted text hash. The `SESSION_SECRET` protects both session data and map signatures; changing it invalidates active sessions and old map reuse, but does not erase saved artifacts.

The app does not migrate or copy PDFs. Drive access is limited to files the user selects through Google Picker and files the app creates. If a PDF is deleted or replaced in Drive, its saved reference may remain, and a changed checksum prevents attaching new AI output to the old content.

## Whole-document processing

PDF.js extracts text from pages 1 through the last page in order. The client partitions this text into contiguous chunks (up to 45,000 characters and 80 chunks). Every chunk must complete; the server validates signed results, their source checksum, ordering, and full page coverage before finalizing. Summary generation first makes page-range digests, then synthesizes one document summary. Quiz generation makes source-backed questions from each chunk, then selects across the whole page span and scores submitted answers on the server.

The full set of pages is *visited*, but coverage of meaning is limited by PDF text extraction and AI quality. Scans without a text layer, images, formulas, diagrams, unusual fonts, and PDF structure may not be understood. Pages with little extractable text are flagged. There is no OCR. The server checks page-range metadata supplied by the client, but does not independently extract the PDF text a second time. Model output is validated structurally and questions require a quoted source phrase; educational accuracy still needs human review.

To bound cost and memory, the app accepts downloadable PDFs up to 250 MB and 5,000 pages. It rejects a document that would need more than 80 text chunks or one page whose extracted text exceeds the chunk limit. Chunk maps are kept in Drive to recover from interrupted processing. Google and NVIDIA limits, network errors, and browser memory can still interrupt large documents; the UI shows an error, and no partial final artifact is saved.

Each non-cached model call, including a retry, reserves one usage record in the requesting user's Drive before inference. The default is 200 calls per user per UTC day; one in-flight AI operation per user and four total are admitted per Node process. The shared NVIDIA key remains server-side. These limits are protective but not an atomic global budget across Vercel instances: Drive listing can lag and users can delete their own app data. Check whether this NVIDIA account offers a provider-enforced cap and configure a Vercel Firewall rule for public abuse protection. See [MULTI_USER_ARCHITECTURE.md](MULTI_USER_ARCHITECTURE.md).

## Deployment

This is a Next.js application with no persistent server disk. It can run locally or on a Next.js host with HTTPS. It has no offline PDF cache or service worker; Home Screen installation works, but reading and AI require network access. Google Picker and OAuth need the exact deployed origin. `NEXT_PUBLIC_` Picker values are fixed at build time.
