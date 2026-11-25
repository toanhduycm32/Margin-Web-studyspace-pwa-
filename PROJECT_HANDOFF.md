# PROJECT CONTEXT HANDOFF
# Personal PDF Reader & AI Learning Application

**Version:** 4.0.0 — Clean Rebuild  
**Date:** November 24, 2026  
**Receiving agent:** Codex  
**Assignment:** Clean rebuild, independent product design, software engineering, implementation, validation, and delivery.  
**Platform:** iPhone-first Progressive Web App  
**Storage:** Google Drive  
**AI provider:** NVIDIA hosted inference API

**Authority:** This handoff supersedes all previous project handoffs, architectural proposals, and supplementary implementation instructions where they conflict with the requirements below.

---

# PART I — PROJECT CONTEXT

## H00 — Identity and Engineering Contract

You are the principal software engineer, software architect, AI integration engineer, and product designer responsible for this application.

The user previously explored several implementations of a personal AI learning application. Those discussions introduced unnecessary architectural complexity, including Supabase, separate storage services, excessive source-selection mechanisms, and potentially overcomplicated application navigation.

The user has now clarified the actual product they want.

The application should be rebuilt from a clean foundation rather than continuing to accumulate modifications around the previous architecture.

You are expected to understand the product's purpose and independently develop the most appropriate implementation.

Do not mechanically reproduce the previous assistant's technical proposals.

### Fundamental working principle

**Preserve the purpose. Respect the restrictions. Freely improve the implementation. Make it exceptionally clean.**

You are encouraged to:

- Think independently.
- Research better solutions.
- Challenge previous assumptions.
- Improve technical architecture.
- Improve the product experience.
- Correct design and engineering mistakes.
- Simplify unnecessary complexity.
- Select suitable technologies.
- Build and validate real functionality.

The user establishes the desired outcomes and product boundaries. You are responsible for determining how to achieve those outcomes effectively.

---

## H01 — Product Purpose and Success Model

### 1.1 Product vision

Build a personal PDF reading application with integrated AI capabilities and persistent Google Drive storage.

The application is primarily intended for learning from educational materials such as textbooks, lecture notes, technical documentation, research materials, and university course resources.

The product should have three essential capabilities:

**1. PDF Library**

The user can store, import, organize, retrieve, and open PDF documents.

**2. Integrated PDF Reader**

The user can read the actual PDF directly inside the application through a continuous vertical scrolling experience.

**3. AI Learning Assistant**

The user can generate:

- A summary of the entire PDF.
- Multiple-choice questions based on the entire PDF.

The application should also allow the user to access previously generated summaries and quizzes, complete quizzes, and review their answers.

### 1.2 What the user actually wants

The desired experience is straightforward:

1. Open the application on an iPhone.
2. Select a PDF from the document library.
3. Read the PDF by scrolling continuously.
4. Access the AI assistant associated with that PDF.
5. Choose Summarize or Generate Quiz.
6. Receive learning resources generated from the entire PDF.
7. Review or save the results.
8. Continue reading or studying.

The user should not need to manually transfer documents between applications.

The user should not need to select individual pages or chapters to make the AI work.

The user should not need to open Google Drive externally to read a document.

### 1.3 Product identity

This application is fundamentally:

**A PDF Reader with integrated AI-powered learning capabilities.**

It is not:

- A general-purpose AI chatbot.
- A comprehensive learning management system.
- An enterprise document management platform.
- A social learning network.
- A complex productivity dashboard.
- A collection of unrelated AI tools.

Maintain a narrow and coherent product identity.

### 1.4 Definition of success

The application is successful when the user can actually use it on an iPhone to open, continuously read, summarize, and generate quizzes from their PDF documents.

Real functionality is mandatory.

A static UI, simulated API response, frontend-only demonstration, or collection of external document links does not satisfy the product purpose.

---

## H02 — Requirements and Authority

### 2.1 Fixed user requirements

The following requirements are established and must be preserved.

| Requirement | Status |
|---|---|
| iPhone-first application | Mandatory |
| PWA delivery | Selected direction |
| Google Drive document storage | Mandatory |
| Google Drive-centric persistence | Required architectural direction |
| Direct in-app PDF viewing | Mandatory |
| Continuous vertical PDF scrolling | Mandatory |
| Whole-PDF summarization | Mandatory |
| Whole-PDF quiz generation | Mandatory |
| Real NVIDIA API integration | Mandatory |
| Reasoning support | Mandatory |
| Clean UI/UX | Mandatory |
| Supabase | Prohibited |
| Separate hosted database | Not required; do not introduce without approval |
| Independent engineering improvements | Explicitly permitted |

### 2.2 Authority order

When making decisions, prioritize:

1. Explicit user requirements and subsequent corrections.
2. The established product purpose.
3. Security, privacy, and verified technical constraints.
4. Actual implementation evidence.
5. Your independently evaluated engineering decisions.
6. Previous assistant suggestions.

The previous assistant's framework choices, UI examples, storage structures, and architectural diagrams are not mandatory implementation specifications.

### 2.3 Development and deployment preferences

The application should be usable without requiring the user to:

- Own a Mac.
- Install Xcode.
- Publish an application through the Apple App Store.
- Purchase Apple Developer Program membership.
- Keep their personal computer continuously running.

Prefer an economical cloud-hosted PWA that can be accessed through Safari and installed on the iPhone Home Screen.

Provide Windows-compatible development and setup instructions.

### 2.4 Cost requirements

Prioritize free services and low-cost operation wherever practical.

Do not automatically activate paid subscriptions or introduce unnecessary commercial infrastructure.

Free service availability, quotas, and usage conditions must be verified rather than assumed.

---

## H03 — Conceptual System Model

### 3.1 Progressive Web App

The application is intended to be delivered as a Progressive Web App.

A PWA is a web application that can provide an application-like experience through supported browser technologies.

The user should be able to access the deployed application through Safari, add it to the iPhone Home Screen, and subsequently launch it through its own application icon.

The PWA should support an appropriate standalone presentation.

Relevant considerations include:

- HTTPS.
- Application manifest.
- Application icons.
- Mobile viewport configuration.
- Standalone display mode.
- iOS safe areas.
- Appropriate caching.
- Application update behavior.
- Responsive interaction.

The application does not need to be a compiled native iOS application.

### 3.2 Google Drive as persistent storage

Google Drive should function as the application's primary persistent storage system.

The user interacts with the application's own library and reader.

Google Drive operates behind the application as a storage provider.

Google Drive may store:

- Original PDF documents.
- Generated summaries.
- Generated quizzes.
- Quiz-attempt records.
- Reading progress.
- Preferences.
- Appropriate internal application records.

The user does not want Supabase or a separate hosted database service as part of the normal architecture.

Structured data can be represented and managed through suitable Google Drive files, metadata, and application-level data mechanisms.

### 3.3 Integrated PDF Reader

The PDF Reader is responsible for rendering the original PDF document directly inside the application.

It should preserve the actual document presentation, including:

- Text.
- Mathematical formulas.
- Images.
- Diagrams.
- Tables.
- Page layouts.

The reader must not be replaced by an external Google Drive link or an AI-generated plain-text representation.

### 3.4 Continuous document experience

A PDF internally consists of pages, but the intended user experience is a continuous vertically scrollable document.

The user does not want a page-by-page interaction model that requires repeatedly pressing Next Page or Previous Page.

The document should behave like a long reading surface.

Internally, the implementation may still manage individual PDF pages for rendering, memory management, text extraction, and navigation.

These internal page boundaries must not become unnecessary restrictions on the user experience.

### 3.5 Whole-document AI processing

The AI assistant operates on the entire currently opened PDF.

The document itself is the source scope.

The page currently visible on the screen does not determine the AI input scope.

For example, if the user is currently reading page 12 of a 300-page textbook and requests a summary, the assistant should summarize the entire 300-page textbook, not only page 12.

Internal document chunking is permitted and may be necessary.

However, chunking is an implementation mechanism, not a manual user workflow.

### 3.6 Learning artifacts

Summaries and quizzes are persistent learning artifacts generated from a source PDF.

They should retain an appropriate association with the source document.

Where practical, preserve:

- Source document identity.
- Document version or content fingerprint.
- Artifact type.
- Creation date.
- Relevant generation settings.
- Model information.
- Processing coverage.

Generated artifacts should remain accessible without unnecessarily repeating the original AI request.

---

## H04 — System Architecture

### 4.1 Conceptual architecture

The intended architecture is:

```text
                iPhone PWA
                    |
        +-----------+-----------+
        |                       |
    PDF Library          Learning Workspace
                                |
                    +-----------+-----------+
                    |                       |
                PDF Reader             AI Assistant
                    |                       |
                    +-----------+-----------+
                                |
                       Application Backend
                                |
                    +-----------+-----------+
                    |                       |
               Google Drive              NVIDIA API
             Persistent Storage        AI + Reasoning
```

This diagram describes system responsibilities, not a mandatory software framework or physical deployment topology.

### 4.2 Frontend

The frontend is responsible for:

- Document-library navigation.
- Document selection and import.
- Integrated PDF rendering.
- Continuous scrolling.
- Reading-state management.
- AI operation controls.
- Summary presentation.
- Quiz generation and interaction.
- Loading, empty, and error states.

The frontend must not expose privileged API credentials.

### 4.3 Backend

The backend should provide the trusted application logic required for:

- Google authentication.
- Authorization.
- Google Drive integration.
- Secure document retrieval.
- Document processing.
- AI request preparation.
- NVIDIA API calls.
- Response validation.
- Persistent-data operations.
- Error recovery.

Choose a backend architecture appropriate to actual document sizes, inference durations, deployment limitations, and security requirements.

### 4.4 Google Drive persistence

Independently design an appropriate Google Drive-centric storage architecture.

An illustrative organization is:

```text
My Google Drive/
└── Learning Workspace/
    ├── Documents/
    │   ├── Machine Learning.pdf
    │   └── Linear Algebra.pdf
    ├── Summaries/
    ├── Quizzes/
    └── Application Data/
```

This structure is illustrative only.

You may instead use appropriate combinations of:

- Drive folders and files.
- JSON records.
- Markdown documents.
- Google Drive file metadata.
- Custom appProperties.
- appDataFolder.
- Local application caches.
- Other suitable data-management mechanisms.

Distinguish user-visible documents from internal application data.

Do not unnecessarily duplicate large original PDF files.

Avoid a single oversized JSON file that contains the entire application state.

Design suitable data identities, indexing, pagination, consistency, versioning, synchronization, and recovery mechanisms.

### 4.5 No Supabase

Do not use:

- Supabase Auth.
- Supabase PostgreSQL.
- Supabase Storage.
- Supabase client libraries.
- Supabase environment variables.
- Supabase-specific deployment requirements.

Supabase has been explicitly rejected by the user.

Do not replace Supabase with Firebase, MongoDB Atlas, Neon, or another hosted database simply because a previous application architecture expected a database service.

First design the application to satisfy its personal-learning requirements through Google Drive-centric persistence.

Local data structures, IndexedDB, in-memory state, and other appropriate client-side mechanisms are permitted.

If a separate external database becomes genuinely necessary, explain the concrete unmet requirement and obtain user approval before introducing it.

### 4.6 Technology selection

Potential implementation technologies include:

| Responsibility | Candidate |
|---|---|
| Frontend | React, Next.js, or another suitable framework |
| Styling | Tailwind CSS or another maintainable styling system |
| PDF rendering | PDF.js or another suitable PDF-rendering library |
| Authentication | Google OAuth 2.0 |
| Persistent storage | Google Drive API |
| AI inference | NVIDIA hosted inference API |
| Local caching | IndexedDB or another suitable browser mechanism |
| Hosting | Vercel or another appropriate cloud platform |
| Source control | Git and GitHub |

These are candidates.

You are free to select, replace, simplify, or improve them based on verified engineering requirements.

Do not introduce unnecessary technologies.

---

## H05 — Core Operational Mechanisms

### 5.1 Google account connection

Implement actual Google OAuth authentication and Google Drive API integration.

The user should be able to connect their Google account and grant the application appropriate access to learning documents.

Evaluate least-privilege authorization, including `drive.file`, Google Picker, and appropriate application-data scopes.

Do not assume that selecting a folder automatically grants access to every existing file contained within it.

Choose a permission model that genuinely supports the intended library workflows.

Handle:

- Google sign-in.
- User consent.
- Access-token expiration.
- Refresh-token lifecycle.
- Revoked permissions.
- Account reconnection.
- Secure application sessions.
- OAuth redirect configuration.
- Applicable Google OAuth testing-mode restrictions.

Restrict application access appropriately for personal usage.

Google Drive authorization and permission to consume the application's NVIDIA API quota should not be treated as automatically interchangeable.

Do not expose an unrestricted public inference endpoint.

### 5.2 Document library

The user should be able to:

- Import existing authorized PDFs from Google Drive.
- Upload new PDFs into the application's Drive-backed library.
- Access previously stored documents.
- Open a document directly.
- Organize documents where useful.
- Search or filter the library where justified.

Prioritize PDF support.

Additional file formats may be considered later, but do not allow optional format support to delay or complicate the core PDF experience.

Use stable document identifiers rather than file names alone.

Handle documents that are renamed, modified, deleted, or no longer authorized.

### 5.3 Continuous PDF reading

Implement a real PDF reader with continuous vertical scrolling.

The user should be able to scroll naturally from the beginning of a PDF to its end.

For example:

```text
┌───────────────────────────┐
│ Machine Learning.pdf      │
├───────────────────────────┤
│                           │
│     Original PDF Page 1   │
│                           │
├───────────────────────────┤
│                           │
│     Original PDF Page 2   │
│                           │
├───────────────────────────┤
│                           │
│     Original PDF Page 3   │
│                           │
├───────────────────────────┤
│             ↓             │
│     Continue scrolling    │
└───────────────────────────┘
```

The above is a conceptual illustration, not a prescribed visual design.

Do not require manual page-by-page navigation as the primary reading mechanism.

Potential supporting mechanisms include:

- Continuous scrolling.
- Zooming.
- Reading-position restoration.
- Efficient page rendering.
- Document search.
- Full-screen reading.
- Optional page indicators or jump controls.

These are independently improvable.

### 5.4 Large-PDF performance

The user may store and read substantial textbooks.

A PDF could contain hundreds of pages and have a considerable file size.

Do not render every page simultaneously if doing so causes excessive memory consumption.

Evaluate appropriate mechanisms such as:

- Lazy page rendering.
- Virtualized document rendering.
- Progressive loading.
- HTTP range retrieval where supported.
- Authorized file streaming.
- Memory-aware rendering.
- Request cancellation.
- Bounded local caching.

The user experience must remain continuous even when the implementation only renders a subset of pages at a given time.

Verify actual hosting and iPhone browser limitations.

Do not assume that the hosting platform can proxy arbitrarily large files without restrictions.

### 5.5 AI Assistant interaction

The AI assistant should be directly accessible from the current PDF reading environment.

It should automatically know which PDF is open.

The primary actions are:

**Summarize**

Generate a summary based on the entire currently opened PDF.

**Generate Quiz**

Generate multiple-choice questions based on the entire currently opened PDF.

Do not require the user to configure page ranges, chapter boundaries, selected passages, or chunk parameters.

Do not introduce a complex generic chat interface merely because the application uses a language model.

The AI interaction should be simple, focused, and document-aware.

Preserve the current reading context when interacting with the assistant.

### 5.6 Whole-PDF content extraction

When an AI operation is requested, obtain the relevant complete PDF source.

The document-processing mechanism should extract the usable content of the entire document.

Keep the following distinct:

- PDF bytes.
- Rendered PDF pages.
- Extracted text.
- Document structure.
- Processing chunks.
- AI context.
- Generated artifacts.

These are different representations serving different responsibilities.

A PDF can be rendered successfully while text extraction fails or produces incomplete content.

Handle or clearly communicate limitations involving:

- Scanned PDFs.
- Mathematical notation.
- Complex tables.
- Multi-column text.
- Embedded images.
- Diagrams.
- Incorrect reading order.
- Password-protected files.
- Damaged documents.

You may introduce OCR, improved extraction, or suitable multimodal processing where justified and compatible with the project's restrictions.

Do not claim complete visual-content understanding from a text-only extraction pipeline.

### 5.7 Whole-PDF summarization

The summarization process should operate on the entire PDF.

A suitable conceptual flow is:

```text
Complete PDF
     |
Content extraction
     |
Context-length assessment
     |
Direct or multi-stage processing
     |
NVIDIA inference
     |
Summary synthesis
     |
Validation and persistence
```

For a sufficiently small PDF, a direct model request may be appropriate.

For a large PDF, independently select a suitable mechanism such as:

- Semantic chunking.
- Section-aware processing.
- Hierarchical summarization.
- Multi-stage synthesis.
- Coverage-aware aggregation.

These are candidate techniques, not mandatory algorithms.

The essential requirement is that the system accounts for the entire document rather than arbitrarily truncating it to fit a model request.

Internal chunks must not become separate mandatory user interactions.

The final summary should preserve important:

- Concepts.
- Definitions.
- Relationships.
- Arguments.
- Mechanisms.
- Conclusions.
- Mathematical ideas where extraction supports them.

Avoid unsupported additions presented as source facts.

If the system cannot process the complete document, disclose the actual processing limitation rather than falsely labeling a partial summary as complete.

### 5.8 Whole-PDF multiple-choice question generation

The question-generation process must consider the entire PDF.

For example, if the user requests 30 questions from a 500-page textbook, the system should generate a representative assessment across the material.

It should not generate all 30 questions from the first few pages simply because those pages are easiest to process.

Whole-document scope does not mean that every fact must appear in a finite quiz. It means that the entire document is considered when determining relevant topics and question coverage.

Independently develop an appropriate mechanism for:

- Document coverage.
- Topic identification.
- Question allocation.
- Question generation.
- Distractor generation.
- Answer validation.
- Duplicate detection.
- Selective regeneration.
- Final quiz assembly.

Do not rely exclusively on a highly compressed summary when doing so would lose the source details necessary for valid questions.

### 5.9 Question structure and quality

A conventional multiple-choice question may contain:

```text
Question
    Identifier
    Question text
    Four answer options
    Correct answer
    Explanation
    Optional source reference
    Optional difficulty metadata
```

Four answer options are a reasonable initial default.

The user may be given simple controls such as:

- Number of questions.
- Difficulty.
- Language.

Do not expose unnecessary model or processing parameters in the ordinary quiz-generation interface.

Validate AI-generated responses before treating them as usable application data.

Address:

- Malformed responses.
- Invalid answer references.
- Missing fields.
- Duplicate questions.
- Multiple valid answers.
- Ambiguous wording.
- Weak or implausible distractors.
- Unsupported claims.
- Incomplete generation.

Structural validation is not sufficient to establish educational correctness.

Evaluate question quality against representative source PDFs.

### 5.10 Quiz-taking experience

The user should be able to complete the generated quiz directly inside the application.

Provide a coherent mechanism for:

- Displaying questions.
- Selecting answer options.
- Submitting answers.
- Evaluating correctness.
- Reviewing explanations.
- Saving or revisiting results.

Keep the quiz definition distinct from individual attempts.

Do not reveal correct answers prematurely in the ordinary quiz-taking interface.

Deterministic scoring should not consume NVIDIA API requests unnecessarily.

### 5.11 Persistence

Generated summaries, quizzes, and appropriate learning state should be stored persistently using the selected Google Drive-centric architecture.

The user should be able to reopen previous learning resources without regenerating them.

Consider document revisions when associating generated outputs with source materials.

A previously generated quiz should not silently be represented as based on an updated PDF if its actual source was an earlier document version.

### 5.12 Worked end-to-end example

Assume the user has a 500-page PDF textbook called `Machine Learning.pdf`.

1. The user opens the PWA.
2. The user selects the textbook from the library.
3. The actual PDF is displayed inside the application.
4. The user scrolls continuously to page 80.
5. The user opens the AI assistant.
6. The user selects Generate Quiz and requests 30 questions.
7. The application resolves the currently opened PDF.
8. The processing pipeline accounts for the entire 500-page source.
9. The system automatically determines whether chunking or staged processing is necessary.
10. NVIDIA generates the required educational content.
11. The application validates and assembles the quiz.
12. The quiz is displayed and persisted.
13. The user completes it and reviews explanations.
14. The user returns to the PDF at the previous reading position.

The source scope in this example remains the entire 500-page PDF, even though the user was reading page 80 when requesting the quiz.

This distinction is essential.

---

## H06 — Decisions and Superseded Requirements

### 6.1 Accepted architecture direction

The current product consists of:

- A Google Drive-backed PDF library.
- A continuous in-app PDF reader.
- A whole-document AI assistant.
- Saved summaries and interactive quizzes.
- A clean iPhone-first PWA.

### 6.2 Superseded requirements and assumptions

Discard previous implementation assumptions that require:

- Supabase.
- Supabase Storage.
- Supabase Auth.
- PostgreSQL as a mandatory external service.
- Another hosted database without a demonstrated requirement.
- A separate page-selection workflow.
- Manual chapter selection before AI processing.
- Selected-text summarization as the central product behavior.
- Page-by-page reading as the primary document experience.
- Separate disconnected AI and document workflows.
- Mandatory generic chatbot functionality.
- Mandatory retention of the previous frontend or backend architecture.

Do not preserve these assumptions merely because they appeared in older handoffs.

### 6.3 Clarification of whole-document behavior

The following two mechanisms are independent:

**Reader rendering scope**

Which pages currently need to be rendered for the user's display.

**AI processing scope**

Which source content the AI operation must consider.

The reader may render only the visible pages for efficiency.

The AI processing scope remains the entire PDF.

Do not accidentally couple these mechanisms.

### 6.4 Clean rebuild decision

The user explicitly requested that the previous implementation be discarded and that the application be rebuilt from the beginning.

The new implementation is not required to preserve the previous architecture, UI, dependencies, or internal implementation structure.

However, the instruction to rebuild the application does not authorize deleting unrelated files, personal documents, external Google Drive data, credentials, or other projects.

The safe rebuild procedure is specified in H12.

---

## H07 — NVIDIA API Integration and Technical Evidence

### 7.1 Preferred initial model

The previously selected model candidate is:

**NVIDIA Nemotron 3.5 Lightning 30B-A3B**

Model ID:

```text
nvidia/nemotron-3.5-lightning-30b-a3b
```

Model page:

https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b/build

This model was previously proposed because of its reported long-context capabilities, reasoning support, structured-output support, and free hosted development endpoint.

Reverify these capabilities against current official documentation.

The model has not yet been benchmarked for this application's actual workloads.

### 7.2 API configuration

Preferred provider interface:

**OpenAI-compatible Chat Completions**

Base URL:

```text
https://integrate.api.nvidia.com/v1
```

Full endpoint:

```text
https://integrate.api.nvidia.com/v1/chat/completions
```

HTTP method:

```text
POST
```

Authentication:

```text
Authorization: Bearer NVIDIA_API_KEY
```

The user has reported creating an NVIDIA API key.

Its actual value and current validity have not been verified in this handoff.

### 7.3 Reasoning configuration

The application must support appropriate reasoning-enabled AI requests.

The previously identified model-specific request parameters are:

```json
{
  "chat_template_kwargs": {
    "enable_thinking": true
  },
  "reasoning_budget": 8192
}
```

Verify the current parameter names, supported values, token limits, streaming behavior, and model-specific restrictions.

Potential reasoning presets:

| Mode | Thinking | Illustrative reasoning budget |
|---|---|---:|
| Fast | Disabled | N/A |
| Balanced | Enabled | 8192 |
| Deep | Enabled | 16384 |

These are provisional configurations.

You may independently optimize or replace them.

Do not hardcode the same inference configuration for every task.

### 7.4 Reasoning and output separation

Keep reasoning-related provider outputs separate from actual learning artifacts.

The user primarily needs:

- Accurate summaries.
- Useful questions.
- Correct answers.
- Educational explanations.

Do not clutter the interface with raw internal reasoning traces.

Provide appropriate progress feedback while the model is processing.

### 7.5 AI engineering freedom

You may independently:

- Evaluate alternative NVIDIA models.
- Improve the default model selection.
- Introduce task-specific model routing.
- Improve prompt construction.
- Improve reasoning configurations.
- Optimize token consumption.
- Improve structured-output handling.
- Improve context-management strategies.
- Improve request batching.
- Improve retry and cancellation behavior.
- Improve educational output quality.

Do not assume that every NVIDIA model supports identical reasoning or structured-output parameters.

Do not switch to a paid provider or introduce additional external document-processing services without appropriate authorization.

### 7.6 API and hosting limitations

Verify actual:

- API availability.
- Rate limits.
- Context limits.
- Output-token limits.
- Reasoning limits.
- Request timeouts.
- Applicable developer-access terms.
- Free-tier restrictions.

Do not assume that a model's advertised maximum context window can always be used in a single hosted request.

Reserve sufficient generation capacity for the final output.

The backend must handle long-document processing without silently truncating source content or losing partial work.

If an operation requires several requests, coordinate them appropriately.

### 7.7 Official technical sources

Use current official documentation as the primary technical reference.

**NVIDIA**

- https://build.nvidia.com/
- https://docs.api.nvidia.com/

**Google Drive**

- https://developers.google.com/workspace/drive/api/guides/about-sdk
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth

**Google OAuth**

- https://developers.google.com/identity/protocols/oauth2/web-server

**Google Picker**

- https://developers.google.com/workspace/drive/picker/guides/overview

**PDF.js**

- https://mozilla.github.io/pdf.js/

**PWA**

- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps
- https://developer.apple.com/

Select and verify additional sources based on the actual implementation.

Do not treat this handoff as proof that an authenticated integration already works.

---

## H08 — Current Project and Artifact State

The earlier project discussions indicate that an implementation may already exist and that it previously requested Supabase and NVIDIA configuration variables.

However, this handoff conversation has not directly inspected that source code.

The actual project state must be established through workspace inspection.

| Component | Known status |
|---|---|
| Product requirements | Clarified |
| Google Drive direction | Selected |
| Supabase | Explicitly rejected |
| PDF reading behavior | Continuous vertical scrolling |
| AI source scope | Entire PDF |
| Previous source code | May exist; not inspected here |
| Previous deployment | Not verified |
| NVIDIA API key | User reports creating one |
| Google OAuth credentials | Not verified |
| Live Google Drive integration | Not verified |
| Live NVIDIA integration | Not verified |
| Physical iPhone testing | Not verified |

Do not invent:

- Repository paths.
- Git branches.
- Commit hashes.
- Deployment URLs.
- Existing implementation details.
- Test results.
- Credential status.
- File locations.

Inspect the actual environment and report the real state.

---

## H09 — Independent Design Authority and Restrictions

### 9.1 Broad engineering freedom

You are explicitly permitted to independently improve and update the application.

You may:

- Redesign the entire UI.
- Create a new application identity.
- Select a different frontend framework.
- Select a different backend framework.
- Develop a better storage architecture.
- Design better application data structures.
- Improve Google Drive integration.
- Improve authentication.
- Improve PDF rendering.
- Improve document processing.
- Improve AI orchestration.
- Improve reasoning.
- Improve summarization.
- Improve question generation.
- Improve persistence.
- Improve security.
- Improve performance.
- Improve accessibility.
- Improve deployment and setup.
- Add necessary supporting mechanisms.
- Refactor or replace your own implementation when justified.

You do not need to request approval for every routine engineering decision.

The user expects you to exercise professional judgment.

### 9.2 UI/UX — Make it exceptionally clean

The application should feel focused, polished, and natural on an iPhone.

The content should receive priority over interface decoration.

Prefer:

- Strong typography.
- Consistent spacing.
- Precise alignment.
- Restrained colors.
- Comfortable reading proportions.
- Meaningful controls.
- Minimal navigation.
- Clear loading and error states.
- Appropriate touch targets.
- Smooth and purposeful interactions.
- Good accessibility.

Avoid:

- Generic AI-generated SaaS dashboard aesthetics.
- Excessive cards.
- Unnecessary dashboard metrics.
- Decorative badges.
- Large promotional headings.
- Excessive gradients.
- Redundant navigation.
- Unnecessary floating controls.
- Permanent panels that consume reading space.
- Excessive configuration options.
- Feature overload.

The product is a reading and learning application.

Its visual design should reflect that purpose.

### 9.3 Information architecture

A possible conceptual arrangement is:

```text
Library
    Stored PDFs
    Import and upload
    Recently opened documents

Document Workspace
    Continuous PDF Reader
    AI Assistant
        Summarize
        Generate Quiz
    Saved learning resources

Settings
    Google account
    Essential preferences
```

You may independently redesign or simplify this structure.

Separate tabs for summaries, quizzes, or other resources are optional implementation decisions.

Do not create additional screens merely to satisfy an illustrative navigation hierarchy.

### 9.4 Supporting functionality

You may introduce small supporting features when they meaningfully strengthen the core experience.

Examples include:

- Reading-position restoration.
- Document search.
- Quiz history.
- Saved summaries.
- Cancellation of AI operations.
- Retry handling.
- Document-processing progress.
- Appropriate backups.
- Exporting learning resources.

These examples are not a mandatory feature backlog.

Improve actual usability rather than maximizing feature count.

### 9.5 Non-negotiable boundaries

You must preserve:

- PDF-focused learning.
- Continuous in-app PDF reading.
- Whole-document summarization.
- Whole-document quiz generation.
- Google Drive persistence.
- No Supabase.
- Real NVIDIA integration.
- Reasoning support.
- Clean UI.
- Privacy and security.

Do not:

- Introduce unrelated product functionality.
- Require unnecessary paid infrastructure.
- Introduce another hosted database without approval.
- Publish private documents.
- Expose credentials.
- Destroy user data.
- Modify unrelated projects.
- Claim unverified functionality is working.

### 9.6 Decision standard

When independently improving the application, evaluate whether the change:

- Solves an actual problem.
- Strengthens the core product experience.
- Improves reliability or maintainability.
- Introduces justified complexity.
- Respects the established restrictions.
- Can be meaningfully verified.

If a simpler mechanism provides equivalent or better results, prefer the simpler mechanism.

---

## H10 — Deployment and User Setup

### 10.1 Deployment objective

The finished application should be remotely accessible without requiring the user's personal computer to remain running.

A candidate architecture is:

```text
GitHub
   |
Cloud Hosting
   |
Application Frontend and Backend
   |
Google Drive + NVIDIA API
   |
iPhone PWA
```

GitHub and Vercel are potential tools, not mandatory dependencies.

Select appropriate infrastructure based on the application's actual requirements.

### 10.2 Environment configuration

A preliminary environment configuration may resemble:

```env
# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# NVIDIA AI
NVIDIA_API_KEY=
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b

# Application security
SESSION_SECRET=
```

This configuration is illustrative.

Determine the actual required environment variables from your implementation.

You may need additional OAuth, application-origin, session, account-authorization, or Google Picker configuration.

Do not include obsolete Supabase variables.

Provide a safe `.env.example` file.

Never include real secrets in source control.

### 10.3 Google Cloud configuration

Provide accurate instructions for the final Google Drive integration.

Depending on the implementation, the user may need to:

1. Create a Google Cloud project.
2. Enable Google Drive API.
3. Enable Google Picker API if used.
4. Configure Google Auth Platform.
5. Configure appropriate OAuth permissions.
6. Create OAuth client credentials.
7. Configure authorized origins and redirect URIs.
8. Connect their Google account.

Determine which of these steps are actually necessary.

Provide exact configuration values where possible.

Consider OAuth testing-mode refresh-token restrictions so that the application does not unexpectedly require frequent account reconnection.

Do not make the user configure unused Google services.

### 10.4 User responsibilities

Minimize manual setup.

Clearly distinguish what you can perform independently from what requires the user to:

- Authenticate an external account.
- Generate credentials.
- Approve permissions.
- Configure secret values securely.
- Authorize deployment.
- Test the application on an actual iPhone.

The user should not be responsible for manually designing database schemas, implementing OAuth, writing backend code, or configuring unnecessary infrastructure.

### 10.5 iPhone installation

The intended installation process is:

1. Open the deployed HTTPS URL in Safari.
2. Select the appropriate sharing or installation option.
3. Add the application to the Home Screen.
4. Launch the application through its icon.

Configure the PWA appropriately.

Verify current iOS behavior.

The intended deployment does not require App Store publication.

### 10.6 Application updates

The user should be able to request future improvements and receive updated application versions without losing existing Google Drive data.

Consider:

- Application caching.
- Service-worker updates where applicable.
- Data-schema compatibility.
- Migration behavior.
- Application-version changes.
- Recovery from interrupted updates.

Do not overwrite or invalidate existing learning artifacts unnecessarily.

---

## H11 — Security, Continuity, and Verification

### 11.1 Security requirements

Maintain appropriate security throughout the application.

- Keep NVIDIA credentials server-side.
- Protect Google OAuth client secrets.
- Protect refresh tokens and sensitive session information.
- Restrict access to authorized documents.
- Validate document identifiers and file-access requests.
- Protect private document caches.
- Avoid exposing privileged credentials through public environment variables.
- Prevent unauthorized consumption of AI resources.
- Treat document contents as untrusted source data.
- Prevent instructions embedded in PDFs from overriding trusted application instructions.
- Validate AI-generated data.
- Avoid logging sensitive source materials unnecessarily.

Do not store long-lived credentials insecurely in frontend JavaScript, public files, or unprotected Google Drive records.

Do not rely on ephemeral serverless files as durable storage.

### 11.2 Failure and recovery

Handle:

- Expired Google authorization.
- Revoked permissions.
- Missing documents.
- Interrupted downloads.
- Unsupported PDFs.
- Failed text extraction.
- Network disconnection.
- NVIDIA rate limits.
- Inference timeouts.
- Malformed AI responses.
- Incomplete document coverage.
- Interrupted application sessions.
- Google Drive storage failures.
- Concurrent or conflicting data updates where applicable.

Failures should not silently destroy user data.

Provide clear and useful recovery behavior.

### 11.3 Acceptance testing

Verify the actual implemented workflows.

**Library and storage**

- Connect an authorized Google account.
- Import an existing PDF.
- Upload a new PDF.
- Retrieve previously stored documents.
- Save and retrieve learning artifacts.
- Verify that no Supabase dependency is required.

**PDF Reader**

- Open a real PDF inside the application.
- Verify original PDF rendering.
- Verify continuous vertical scrolling.
- Verify that reading does not require external Google Drive navigation.
- Evaluate rendering performance with a representative large PDF.
- Preserve reading context when accessing AI.

**Whole-document summarization**

- Generate a summary through a real NVIDIA request when credentials are available.
- Verify that the source scope is the entire PDF.
- Test both short and long documents.
- Confirm that material from the beginning, middle, and end is considered.
- Handle incomplete extraction or processing honestly.

**Whole-document quiz generation**

- Generate questions using the entire PDF as the source.
- Verify representative topic coverage.
- Validate question structures and answer references.
- Evaluate educational correctness against the source.
- Complete and score a generated quiz.
- Retrieve saved quizzes after reopening the application.

**PWA and deployment**

- Verify application build.
- Verify local execution.
- Verify mobile responsiveness.
- Verify PWA configuration.
- Verify cloud deployment when authorized and available.
- Verify Home Screen installation on a physical iPhone when available.

**Security**

- Verify that secret credentials are not exposed.
- Verify document authorization.
- Verify that unauthorized users cannot freely invoke the NVIDIA backend.
- Verify appropriate session-expiration and reconnection behavior.

### 11.4 Evidence discipline

Distinguish clearly between:

- Designed functionality.
- Implemented functionality.
- Mock-based testing.
- Actual authenticated integration.
- Local testing.
- Mobile browser simulation.
- Successful cloud deployment.
- Physical iPhone acceptance testing.

Do not describe a mocked NVIDIA response as verified AI functionality.

Do not describe simulated Google Drive data as verified Google Drive integration.

Do not describe a locally working build as a deployed application.

If credentials are unavailable, continue all independent work that can proceed safely and clearly identify the remaining external integration checks.

### 11.5 Continuity

Maintain useful project documentation so future Codex sessions can understand the actual application.

Preserve:

- Product purpose.
- Current architecture.
- Important design decisions.
- Setup instructions.
- Actual implementation state.
- Verification results.
- Known limitations.
- Remaining work.

Prefer concise, maintained documentation rather than numerous redundant context files.

---

# PART II — CODEX EXECUTION ASSIGNMENT

## H12 — Clean Rebuild and Delivery

### 12.1 Primary assignment

Build a new, functional implementation of the application according to the updated project context.

The previous application architecture is no longer the required foundation.

You are authorized to replace the obsolete implementation within the intended project workspace.

The new application must prioritize:

**Google Drive Library → Continuous PDF Reader → Whole-PDF AI Summarization and Quiz Generation.**

### 12.2 First operation — inspect and establish a safe rebuild boundary

Before removing or replacing existing code:

1. Identify the actual project root.
2. Inspect existing files, repository instructions, and Git status.
3. Identify the exact old application implementation that is within the rebuild scope.
4. Identify unrelated files, user documents, environment files, credentials, and other protected data.
5. Preserve a recoverable snapshot of the existing application and any unique uncommitted work.
6. Verify that the recovery mechanism is usable.
7. Establish the intended location where the rebuilt application will be delivered.

Do not assume that Git history preserves untracked files or uncommitted changes.

Do not commit secret credentials as part of creating a recovery snapshot.

If the project boundary cannot be safely established, isolate the new implementation in an authorized location until the ambiguity is resolved.

### 12.3 Remove the obsolete implementation

Once the approved project boundary and recovery mechanism are established, remove or replace the obsolete application implementation as appropriate.

Do not preserve old code merely for compatibility when it provides no value to the new application.

Remove obsolete Supabase-related source code, dependencies, environment requirements, and documentation.

Protect:

- Personal documents.
- Google Drive contents.
- API keys.
- OAuth credentials.
- Unrelated files.
- Other projects.
- Recoverable repository history.

Do not delete external services, repositories, databases, accounts, or cloud data as part of local source-code cleanup.

Respect applicable workspace and destructive-operation approval requirements.

### 12.4 Design and implement independently

Choose the most appropriate architecture and technologies.

Build the actual application.

The finite initial implementation should provide:

1. Clean iPhone-first UI.
2. Google authentication and Drive integration.
3. Persistent PDF library.
4. Continuous in-app PDF rendering.
5. Whole-PDF content processing.
6. Real NVIDIA integration with reasoning support.
7. Whole-PDF summarization.
8. Whole-PDF multiple-choice question generation.
9. Interactive quiz completion.
10. Persistent learning artifacts.
11. Appropriate error handling and security.
12. PWA installation configuration.
13. Practical deployment readiness.

You have freedom over implementation methods, sequence, libraries, architecture, and design.

Research material uncertainties, make justified decisions, implement, and verify.

Do not stop after producing another conceptual proposal.

### 12.5 Deliverables

Provide the following in the intended project workspace:

- Complete application source code.
- Necessary application configuration.
- Safe environment-variable templates.
- Google Drive initialization or data-management mechanisms.
- Relevant tests.
- README and setup documentation.
- Deployment instructions.
- Google OAuth setup instructions.
- NVIDIA API configuration instructions.
- iPhone installation instructions.
- A concise account of actual implementation and verification status.

If development occurs in a separate checkout, reconcile the finished implementation with the intended user-visible project location when authorized.

Verify the delivered copy, not only the development copy.

### 12.6 Completion criteria

**Complete**

All requirements of the agreed milestone are implemented and verified in the intended delivery location.

**Partial**

A meaningful working implementation is delivered, but clearly identified requirements or external verification steps remain incomplete.

**Blocked**

A specific dependency prevents further eligible progress.

If external credentials are missing, finish all feasible independent work and explain precisely what the user must configure next.

Distinguish source-code completion, authenticated external integration, deployment readiness, successful deployment, and physical iPhone testing.

Do not claim full completion without supporting evidence.

### 12.7 Final operating instruction

Act as an independent software engineer and product designer.

Do not mechanically follow inferior previous implementation choices.

Do not repeatedly ask the user to approve ordinary engineering decisions.

Do not create unnecessary infrastructure.

Do not introduce Supabase.

Do not complicate the user experience with manual source-scope selection.

Do not turn a PDF reader into a generic chatbot or learning management system.

Improve whatever can reasonably be improved within the established product purpose.

The user wants a focused, functional application:

**Open a PDF. Scroll and read. Summarize the entire PDF. Generate quizzes from the entire PDF. Study. Save. Repeat.**

Keep the infrastructure simple.

Keep the underlying mechanisms reliable.

Keep the application exceptionally clean.

**Preserve the purpose. Freely improve and update the implementation. Build the real product.**

---

END OF PROJECT CONTEXT HANDOFF