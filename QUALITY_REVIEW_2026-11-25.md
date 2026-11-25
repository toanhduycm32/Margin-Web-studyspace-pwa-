# Quality review — 2026-11-25

## Scope and outcome

This pass examined the implemented PDF reader, whole-document text pipeline, NVIDIA prompts, Drive persistence, OAuth boundary, responsive UI, and deployment guidance against the current product requirements. The app remains a single-owner Google Drive application without Supabase or a hosted database. Source code and tests were changed where the review found concrete defects or unnecessary work.

## Findings and changes

| Area | Finding | Change | Evidence |
| --- | --- | --- | --- |
| Whole-PDF extraction | PDF.js text items were joined into one string and page whitespace was collapsed, erasing useful heading and line boundaries before AI processing. All extracted pages were also held in a second array before partitioning. | Preserve PDF.js line endings, normalize each line, and append pages directly to bounded chunks. Reject overflow as soon as it occurs. | Unit test checks line boundaries and the 80-chunk limit; the existing three-page real-PDF integration test checks beginning, middle, and end. |
| Continuous reader | Changing the document ID could retain reader component state, and visible-page tracking caused every page component to render again on scroll. | Key the reader by document ID and memoize individual page surfaces. | Typecheck and production build pass. Rendering performance on a physical iPhone still needs measurement. |
| Summary display | The AI output was displayed as raw text, including Markdown heading markers. | Render headings, lists, paragraphs, and bold text as safe React elements without HTML injection. | Typecheck and production build pass. |
| Quiz and answer quality | Questions have source excerpts, unique options, a valid answer index, and coverage selection across the PDF, but these checks cannot prove semantic correctness. | Kept the existing strict source/structure checks; no unsupported claim of factual verification is made. | Existing quiz tests pass. A human review of a real generated quiz remains necessary. |
| Persistence and access | Drive app data maps are signed, cached by PDF checksum/text hash, and verified for complete page coverage before an artifact is saved. OAuth sessions are encrypted and owner restricted. | Preserved record schema and security boundaries. | Existing store, session, and crypto tests pass. Interactive Drive artifact recovery remains to be checked. |

## Verification

- `pnpm typecheck`: passed.
- `pnpm test`: 21 tests in 9 files passed.
- `pnpm build`: passed.
- Source scan found no local Google client secret, session secret, NVIDIA key, or Picker key in files selected for Git. The ignored `.env.local` remains local.
- Prior local browser verification showed a 354-page Drive PDF rendering continuously after the byte-range repair. This pass did not repeat a physical iPhone performance measurement or a real whole-PDF NVIDIA run.

## Remaining work

- Run an end-to-end summary and quiz on the owner's PDF and review factual accuracy, diversity, explanations, and page coverage.
- Verify artifact persistence, retry after interruption, reconnect, and Drive upload in a real account session.
- Measure scrolling and memory on an actual iPhone, then tune page rendering if needed.
- Deploy to HTTPS after a production URL is known, configure the matching Google OAuth/Picker origins, and test the installed Home Screen flow.
