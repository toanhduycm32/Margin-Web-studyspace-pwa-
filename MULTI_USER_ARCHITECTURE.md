# Multi-user authorization decision — 2026-11-25

## Outcome and authority

Margin serves multiple explicitly authorized Google accounts at one deployed origin. Each device has an independent encrypted cookie. A successful OAuth callback verifies the Google email, checks it against `AUTHORIZED_GOOGLE_EMAILS`, and records Google's stable `sub`. Every protected request checks the current allowlist; removing an email denies existing sessions on their next request. `OWNER_EMAIL` is a migration fallback only when the new variable is absent. The current user request supersedes the earlier single-owner passages in `PROJECT_HANDOFF.md`.

## Tenant boundaries

| State | Owner and enforcement |
| --- | --- |
| OAuth access/refresh tokens | Encrypted HTTP-only, SameSite=Lax cookie on each browser; 30-day absolute session lifetime. No server token table or browser JavaScript access to refresh tokens. |
| PDF bytes and metadata | Google Drive token from the current session. The range-proxy verification cache is keyed by a hash of that token and file ID, with a 60-second lifetime. |
| Library, progress, artifacts, attempts | Google `appDataFolder` for the current token; no cross-user database or global record lookup. |
| Incomplete AI maps | Schema 2 contains Google `sub` inside the signed record. Finalization rejects a map whose `sub` differs from the current session, even for a shared PDF with the same file ID and MD5. Old schema 1 maps are not reused; existing finished artifacts remain readable. |
| AI usage | A reservation record in the current user's app data before each non-cached NVIDIA call. The server never sends the NVIDIA key to a browser. |

## Quota and scaling decision

The application defaults to 200 model calls per user per UTC day, one simultaneous call per user, and four calls per Node process. The daily limit and process limit can be configured with `AI_DAILY_CALL_LIMIT` and `AI_PROCESS_CONCURRENCY`. Cached signed chunk maps do not consume another model call. Failed inference still consumes a reservation, preventing unrestricted retry loops. Invalid or unavailable Drive usage data fails closed before NVIDIA is called.

This is a **bounded best-effort application quota**, because a Drive list/create pair is not an atomic global counter and Vercel may execute requests in different processes. A user who deletes their own app data can also remove usage records. A hard global spend/concurrency guarantee requires a provider-enforced cap (if offered for this NVIDIA account) or a shared atomic service. The user has excluded an additional hosted database, so check the NVIDIA account's actual quota controls and use Vercel Firewall rate limiting for an additional edge guard. Do not present the Drive ledger or process semaphore as a globally strict quota.

An open signup or domain-wide allow rule was rejected because it would authorize unreviewed users to spend the shared NVIDIA quota. A hosted auth database would offer dynamic membership and atomic controls but violates the current no-new-database restriction. Adding a **new** allowed email to Vercel's environment requires a new deployment; an **already-listed** user needs no change or redeployment to sign in from another device.

## Acceptance and current evidence

- Simulated independent OAuth browser sessions for two different verified emails pass concurrently. Both see their own Drive-backed library records; a cross-account artifact lookup returns 404. The PDF verification cache separately checks the two access tokens even when their file ID is identical.
- A removed email receives 401 with an existing cookie; a 31-day-old cookie is rejected; an unlisted Google identity receives no session and its refresh token is revoked.
- A signed map from one Google `sub` is rejected when another `sub` tries to finalize it, even if both can open the same PDF.
- Tests cover two concurrent users entering NVIDIA admission, a second simultaneous call for the same user being denied, separate daily limits, and oversized streamed AI requests.
- GitHub commit `68c8c09` received a successful Vercel status. The production site serves the new multi-user bundle; unauthenticated library access returns 401 and OAuth start uses the exact production callback.
- Real simultaneous Google consent and Drive operations for two accounts remain unverified until a second email is added to both Vercel's allowlist and (while Google consent is in Testing) the OAuth test-user list, and both users participate in sign-in. No second user's credentials were supplied or simulated as real.

## Rollout and rollback

Set `AUTHORIZED_GOOGLE_EMAILS` to a comma-separated list containing the current owner and every additional authorized email. Keep `SESSION_SECRET` and the existing OAuth client ID stable so current sessions and Drive app data survive. After deployment, sign in both accounts in separate browser profiles and verify each library and a PDF/AI action. If reverting code, the old single-owner version can still read finished schema 1 artifacts; schema 2 intermediate maps will be ignored. New usage reservation files remain in each user's Drive and are not user-visible.
