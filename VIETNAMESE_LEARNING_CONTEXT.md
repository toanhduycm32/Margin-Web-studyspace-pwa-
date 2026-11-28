# MARGIN — VIETNAMESE MEDICAL & DENTAL LEARNING UPGRADE

Current authority: the owner's 28 November Engineering Workflow & AI Execution Redesign, maintained in [ARCHITECTURE.md](ARCHITECTURE.md). Practical educational quality supersedes maximum depth, one-objective/one-question allocation, fixed Mistral primary, uniform tiny review batches and rigid summary-length gates. Question quantity, explanation length and advanced sophistication may decrease; medical/source correctness, major-section coverage, Vietnamese output, meaningful diversity, multiple-correct majority, isolation and safe replacement remain protected. Both engineering and runtime workflows belong to ARCHITECTURE.md; observed progress belongs to STATUS.md and AI_QUALITY_DECISIONS.md. The older detailed domain guidance below is retained only where compatible with these current priorities. MODEL_QUALIFICATION_CONTEXT.md is historical investigation context, not a requirement to repeat the model comparison.

## Current Context Handoff

**Date:** November 27, 2026\
**Receiving agent:** ChatGPT Work\
**Project:** Margin\
**Phase:** Medical and dental educational intelligence, product simplification, Vietnamese specialization, and generated-resource lifecycle improvement.

This context update supersedes conflicting requirements in the previous Medical & Dental AI Learning Intelligence Upgrade handoff.

Preserve all unaffected project requirements, useful implementation, research, and completed work.

---

# 1. Updated product direction

The user has clarified that Margin will primarily serve Vietnamese-speaking medical and dental students, particularly students studying Dentistry and Odonto-Stomatology (Răng Hàm Mặt).

The principal source materials are actual educational documents used by students:

- University textbooks.
- Lecture notes.
- Lecturer-provided PDF materials.
- Lecture slides.
- Course handouts.
- Medical and dental theory materials.
- Clinical learning materials.
- Examination preparation materials.

Margin should transform these materials into useful Vietnamese learning resources.

The core experience remains:

**Open a PDF → Read continuously → Generate a summary or assessment → Study.**

The user does not want numerous generation modes, writing-style selectors, complicated configuration panels, or excessive product features.

Instead, the user wants one highly developed educational experience whose underlying intelligence automatically adapts to the source material.

## Protected project requirements

Preserve:

- The existing iPhone-first PWA.
- Continuous vertical PDF reading inside Margin.
- Google Drive-centric persistence.
- Independent authorized Google accounts and private libraries.
- Whole-PDF processing.
- Real NVIDIA-hosted inference.
- Mistral Large 4 as the selected primary model direction.
- Secure credential handling.
- Exceptionally clean UI/UX.
- No Supabase.
- No additional hosted database or paid infrastructure without approval.

This is an upgrade of the existing application, not a clean rebuild or a separate product.

---

# 2. Vietnamese-first medical and dental specialization

Vietnamese is now the primary language of the product's educational experience.

This requirement applies to:

- Application navigation.
- Buttons and labels.
- AI-generated summaries.
- Question stems.
- Answer options.
- Clinical scenarios.
- Answer explanations.
- Educational feedback.
- Processing status.
- Error and recovery messages.
- Source and evidence descriptions.

## 2.1 Professional Vietnamese writing

Develop a consistent professional Vietnamese writing standard appropriate for university-level medical and dental education.

Generated content should use:

- Accurate Vietnamese medical terminology.
- Natural academic Vietnamese.
- Coherent and substantial paragraphs.
- Precise descriptions of medical mechanisms.
- Clear clinical distinctions.
- Appropriate technical vocabulary.
- Accurate relationships between concepts.
- Correct terminology for anatomy, physiology, pathology, diagnosis, and treatment.

Avoid mechanically translated English sentences.

Do not simplify technical concepts merely because the output is in Vietnamese.

Preserve important international terminology, abbreviations, disease classifications, numerical values, units, and English or Latin technical terms where appropriate.

For example, an established Vietnamese technical term may be accompanied by its English equivalent on first introduction when doing so improves comprehension.

Do not unnecessarily repeat bilingual terminology throughout every paragraph.

Preserve the terminology used by the source textbook unless a correction or clarification is necessary and explicitly identified.

## 2.2 Domain-specific language context

Independently research the vocabulary and writing conventions used in Vietnamese medical and dental educational materials.

Develop suitable terminology guidance and calibration examples.

Investigate relevant differences between:

- Vietnamese medical textbooks.
- Vietnamese dental textbooks.
- University lecture slides.
- Clinical examination materials.
- International medical terminology.
- Vietnamese translations of international guidelines.

Do not assume that literal translation is sufficient.

The resulting Vietnamese content should read like a carefully prepared medical learning resource, not a generic translated AI answer.

---

# 3. Simplify the application to one educational mode

The previous handoff proposed multiple summary profiles, such as Quick Review, Academic Summary, Deep Medical Study, Clinical Review, and Exam Revision.

The user no longer wants these as separate selectable product modes.

Replace that design with **one canonical medical and dental educational intelligence mode**.

The user should not need to choose among different summary styles, reasoning presets, language modes, or complicated assessment configurations before studying.

## 3.1 One mode does not mean one rigid processing method

The system must still adapt intelligently to different source materials.

For example:

- An anatomy lecture requires structural and spatial explanations.
- A pathology lecture requires disease mechanisms and causal relationships.
- A clinical lecture requires symptoms, signs, diagnostic distinctions, and applicable clinical conditions.
- A pharmacology lecture requires mechanisms of action, indications, adverse effects, and contraindications.
- A dental materials lecture may require properties, comparisons, limitations, and appropriate applications.

These differences should be handled automatically by the internal rule system.

Do not expose them as unnecessary product modes.

The underlying system may use different agent responsibilities, instructions, prompt templates, processing strategies, or internal configurations where justified.

The user-facing experience remains unified.

## 3.2 Simplified interaction

The ordinary document workspace should primarily offer:

**Tóm tắt tài liệu**

Generate a complete, structured Vietnamese learning summary.

**Tạo trắc nghiệm**

Generate an appropriate Vietnamese assessment covering the entire PDF.

When a result already exists, the application should provide a clear way to generate a replacement.

Independently determine the cleanest presentation.

Do not introduce additional controls simply because the underlying AI system supports configurable parameters.

---

# 4. One high-quality summarization standard

Develop a single canonical summarization rule system optimized for medical and dental students.

The goal is not an abstract, executive summary, or superficial list of important points.

The goal is a structured learning resource that helps a student understand, review, and retain the important knowledge contained in an entire PDF.

## 4.1 Preserve the actual structure of the source

The system must first understand the complete document.

Identify its substantive:

- Lessons.
- Chapters.
- Major sections.
- Supporting subsections.
- Learning objectives.
- Important knowledge relationships.

Generate a meaningful summary for every major substantive section.

For example:

Original PDF:

- Bài 1. Răng và bộ răng.
  - Cấu tạo răng.
  - Bộ răng.
  - Tuổi mọc răng.
  - Khớp cắn.
- Bài 2. Biến chứng do mọc răng.
- Bài 3. Viêm lợi.

The generated summary should preserve the actual educational organization of these lessons and sections.

Do not collapse the material into one generic summary.

Do not present arbitrary processing chunks as source headings.

Select an appropriate heading hierarchy according to the source document.

Distinguish original headings from inferred semantic divisions.

Administrative front matter, references, and repeated non-substantive content do not need to receive the same summarization treatment as instructional sections.

## 4.2 Canonical writing voice

The initial proposed voice is:

**Professional, academic, explanatory Vietnamese suitable for university-level medical and dental study.**

The writing should be information-dense without becoming unnecessarily difficult to read.

Prefer meaningful paragraphs that explain concepts and relationships.

Use lists, tables, definitions, or structured comparisons when they improve learning.

Do not convert the entire document into fragmented bullet points.

Do not produce unnecessary introductory statements, repetitive conclusions, or generic AI commentary.

## 4.3 Adaptive summary length

Establish a concrete and measurable length policy.

An initial target for a substantial major section is approximately **200–400 Vietnamese words**, with longer treatment for complex sections and shorter treatment for simple sections.

A complex mechanism or clinical section may require approximately 400–800 words or more when the source warrants it.

These are preliminary engineering defaults, not fixed academic standards.

Develop a more appropriate allocation policy through research and evaluation.

The system should consider:

- Original section length.
- Knowledge density.
- Educational importance.
- Clinical significance.
- Number of important concepts.
- Relationships between concepts.
- Complexity of mechanisms.
- Necessary assumptions and exceptions.

Do not pad short sections.

Do not remove important medical conditions merely to meet a word-count target.

The complete summary should remain appropriately substantial relative to the PDF.

A large textbook must not be reduced to the same output length as a short lecture.

## 4.4 Domain-adaptive rules

Develop detailed rules for different knowledge types within this single mode.

For example:

| Knowledge type | Expected summarization behavior |
|---|---|
| Anatomy | Preserve structure, position, function, and anatomical relationships |
| Physiology | Explain mechanisms, regulation, and functional relationships |
| Pathology | Preserve disease processes, progression, and important distinctions |
| Pathophysiology | Explain causes, mechanisms, and resulting consequences |
| Clinical manifestations | Preserve symptoms, signs, typical presentations, and important exceptions |
| Diagnosis | Preserve relevant findings, diagnostic criteria, investigations, and differential distinctions |
| Treatment | Preserve indications, contraindications, applicable conditions, and limitations |
| Pharmacology | Preserve mechanisms, indications, adverse effects, interactions, and clinically important qualifications |
| Dental materials | Preserve composition, properties, applications, advantages, and limitations |

These are preliminary examples.

Independently research and develop more complete rules suitable for Vietnamese medical and dental curricula.

## 4.5 Summary quality requirements

The summary must preserve:

- Source accuracy.
- Important definitions.
- Medical and dental terminology.
- Causal relationships.
- Mechanisms.
- Classifications.
- Clinically relevant distinctions.
- Important conditions.
- Numerical information where necessary.
- Relevant examples.
- Source limitations.

Do not silently add external knowledge and represent it as though it appeared in the original lecture.

Where external evidence is used, distinguish it from the source's original teaching.

Develop positive and negative Vietnamese calibration examples showing source material, generated summary, quality assessment, omissions, distortions, and appropriate repairs.

---

# 5. One adaptive medical and dental assessment mode

The user also does not want numerous quiz-generation modes.

Provide one intelligent assessment-generation experience that automatically decides how to construct a useful question bank from the complete PDF.

The question bank should contain different question formats and cognitive demands internally.

A single generation mode must not become a single repetitive question type.

## 5.1 Required question characteristics

Preserve the previously established requirements:

- Vietnamese-language questions.
- Medical and dental theoretical knowledge.
- Clinical reasoning questions.
- Clinical vignettes.
- Applied knowledge questions.
- Meaningful conceptual diversity.
- Plausible distractors.
- Accurate answer keys.
- Detailed educational explanations.
- Whole-document coverage.
- A majority of questions with multiple correct answers.

Support single-best-answer questions where they are educationally or clinically appropriate.

Do not force every diagnostic or management question into a multiple-response format.

The previous proposal of approximately 75% multiple-correct-answer questions remains a starting point, not a rigid mandatory percentage.

The user's preference for a majority of multiple-correct-answer questions must be preserved.

## 5.2 Independent question taxonomy

Continue the previous research into medical and dental assessment design.

Develop a substantive taxonomy of question families, subtypes, constructions, cognitive demands, and distractor mechanisms.

For example:

- Definitions and classifications.
- Anatomical and functional relationships.
- Physiological mechanisms.
- Pathological mechanisms.
- Risk factors and etiology.
- Symptoms and clinical findings.
- Diagnostic differentiation.
- Investigation interpretation.
- Clinical reasoning.
- Indications and contraindications.
- Treatment principles.
- Complications.
- Prevention.
- Integrated foundational and clinical reasoning.

Each family should contain sufficiently detailed construction rules.

For each meaningful subtype, determine:

- What educational objective it assesses.
- Which source evidence is necessary.
- How the stem should be constructed.
- How difficulty is established.
- What makes its correct answer defensible.
- What constitutes an effective distractor.
- What makes the question ambiguous or invalid.
- How the explanation should be written.

Develop the detailed taxonomy independently through domain research.

## 5.3 Adaptive question quantity

Do not restrict assessment generation to fixed choices such as 5, 10, 20, or 30 questions.

The system should determine an appropriate question quantity automatically based on the PDF's actual educational content.

A substantial lecture may justify 40–80 questions.

A large chapter or textbook may justify 100 questions or considerably more.

These are illustrative planning ranges, not a rigid formula.

Develop a question-capacity mechanism based on:

- Major sections.
- Learning objectives.
- Important concepts.
- Knowledge relationships.
- Clinical applicability.
- Potential assessment constructions.
- Meaningful question diversity.
- Required coverage.
- Available evidence.

Do not generate superficial variants to artificially increase the count.

Do not stop generating at a small arbitrary limit when significant important knowledge remains unassessed.

Use bounded batches and recoverable workflows to accommodate actual provider limits.

## 5.4 Assessment blueprint

Before producing a substantial question bank, establish appropriate document-level assessment planning.

Use the complete PDF to determine what should be assessed.

Allocate questions across important sections and concepts according to their educational significance.

Include both theoretical and clinical questions when the source supports them.

Do not generate questions exclusively from the first sections of a document.

Do not equate processing every page with assessing every important concept.

Represent meaningful coverage and any limitations honestly.

## 5.5 Vietnamese question-writing standard

Question stems should resemble carefully written Vietnamese medical and dental university assessment items.

They should be technically precise, natural, and professionally worded.

Avoid:

- Awkward translations.
- Repetitive sentence constructions.
- Obviously incorrect distractors.
- Unsupported medical assumptions.
- Unnecessary patient details.
- Gratuitously difficult vocabulary.
- Ambiguous response instructions.
- Predictable correct-answer patterns.
- Repeated questions that assess the same micro-concept.

For multiple-response items, evaluate each option independently.

Every correct option must be supported.

Every incorrect option must be incorrect under the stated conditions.

Provide clear instructions such as:

"Chọn tất cả đáp án đúng."

When the number of required selections is specified, ensure that the answer key and interaction agree.

## 5.6 Answer randomization and scoring

Preserve the previously established randomization requirement.

Use stable option identifiers and application-level randomization.

Randomize option order at appropriate new-attempt boundaries.

Preserve order during the active attempt.

Do not break linked clinical questions, ordered sequences, or other meaningful option relationships through indiscriminate shuffling.

Implement reliable multi-answer grading.

Exact-set correctness is the initial recommended default, with educational feedback showing correct selections, missed correct options, and incorrect selections.

Provide Vietnamese explanations for why each option is correct or incorrect.

Preserve deterministic scoring without unnecessary model calls.

---

# 6. Research authentic Vietnamese educational assessment materials

The user wants questions that are useful for actual medical and dental study and examination preparation.

Continue researching the following user-provided reference:

https://letqa.vn/test-template/noi-co-so-2/5041

Use it to understand Vietnamese medical examination patterns.

Research additional appropriate:

- Medical university examination materials.
- Dental university examination materials.
- Publicly accessible clinical question banks.
- Vietnamese medical theoretical assessments.
- Vietnamese dental assessments.
- Publicly available sample examinations for medical and dental students.

Continue using NBME, USMLE, INBDE, university teaching guidance, and relevant assessment research to improve educational quality.

Do not simply reproduce questions from external examination banks.

Generate original questions and learn from the underlying assessment mechanisms.

## 6.1 Source roles must remain distinct

The system should distinguish three fundamentally different source roles.

**Learning source:** The textbook or lecture PDF that the learner wants to study. This is the primary authority for the source's structure and intended educational content.

**Assessment-pattern source:** Public examination examples used to understand question constructions and assessment practices.

**Medical verification source:** Reliable guidelines, professional references, and relevant research used to verify medical claims or distinguish current clinical knowledge from outdated teaching.

Do not confuse these roles.

For example, a Ministry of Health treatment guideline may be useful for verifying a clinical question. It is not automatically the best representative test document for a student's lecture-based learning workflow.

---

# 7. Vietnamese learning PDF for implementation testing

The initial representative test document must be a genuine educational PDF intended for students.

Use the following candidate:

**Răng Hàm Mặt — Sách dùng cho sinh viên đa khoa**

Institution: Trường Đại học Y Hà Nội, Viện Đào tạo Răng Hàm Mặt.

Editor: PGS.TS. Tống Minh Sơn.

Publisher: Nhà xuất bản Giáo dục.

Publication year: 2022.

Publicly accessible PDF reference:

https://storage-vnportal.vnpt.vn/sla-ubnd/5550/tailieuthamkhao/Nhung/R%C4%83ng%20h%C3%A0m%20m%E1%BA%B7t.pdf

The document's introductory material identifies it as a textbook for medical students studying dentistry and odonto-stomatology.

The textbook contains 11 lessons and includes learning objectives, substantive instructional sections, and self-assessment material.

The previous conversation inspected its introductory text and table of contents, but did not verify every page visually or execute it through Margin.

## 7.1 Why this source is appropriate

The source can help evaluate:

- Vietnamese medical terminology.
- Document structure recognition.
- Lesson and section identification.
- Theoretical knowledge extraction.
- Clinical knowledge extraction.
- Summarization of major sections.
- Clinical and theoretical question generation.
- Assessment blueprinting.
- Long-document coverage.
- Adaptive question quantity.

Its educational structure provides a more representative test than a standalone clinical guideline.

## 7.2 Testing expectations

Acquire the PDF through an authorized, accessible source.

Verify its actual contents and usage permissions before processing or retaining it.

Do not bypass access restrictions.

Do not redistribute copyrighted educational materials unnecessarily.

Use the textbook's actual learning objectives and organization to develop meaningful evaluation criteria.

Do not copy existing self-assessment questions as though they were newly generated by Margin.

Begin with manageable educational sections or authorized smaller fixtures for debugging.

Then evaluate the actual full-document workflow.

A successful test on one selected chapter does not establish successful whole-textbook processing.

Independently find additional Vietnamese lecture PDFs and student learning materials when needed to verify different layouts, subject areas, and learning tasks.

Medical guidelines should remain supporting verification sources, rather than replacing these educational test inputs.

---

# 8. Preserve and deepen AI context engineering

The previous handoff established requirements for carefully developed runtime context, instructions, prompts, rules, agents, examples, and workflows.

Those requirements remain in force.

The removal of multiple user-facing modes must not reduce the sophistication of the internal AI system.

Instead, concentrate the research and engineering effort on one well-developed educational standard.

## 8.1 Required internal knowledge and rule responsibilities

Develop and maintain suitable components for:

- Vietnamese medical and dental domain context.
- Medical terminology rules.
- Source-document interpretation.
- Whole-document coverage.
- Section-level summarization.
- Academic Vietnamese writing.
- Adaptive length allocation.
- Assessment blueprinting.
- Theoretical question construction.
- Clinical question construction.
- Multiple-response questions.
- Distractor construction.
- Difficulty estimation.
- Answer explanation.
- Medical evidence verification.
- Educational quality evaluation.
- Output rejection and repair.

These are responsibilities, not mandatory individual agents or files.

Independently determine how to organize them.

## 8.2 Agent instructions and task-specific prompts

Each model-driven responsibility should receive carefully constructed instructions appropriate to its task.

For example, a clinical question generator should receive the relevant:

- Domain context.
- Source evidence.
- Learning objective.
- Clinical construction rules.
- Multiple-response rules.
- Medical verification requirements.
- Vietnamese writing standards.
- Positive and negative calibration examples.
- Structured output requirements.

A summary generator should receive the relevant source section, its relationship to the full PDF, applicable domain rules, appropriate length allocation, and the canonical Vietnamese writing standard.

Do not give every agent an identical generic prompt.

Do not send all available context to every model call when only a subset is relevant.

## 8.3 Calibration examples

Develop substantial Vietnamese examples demonstrating:

Source passage → Educational objective → Generated summary or question → Supporting evidence → Quality assessment → Failure or repair.

Include both theoretical and clinical examples.

Include examples of:

- Weak summaries.
- Excessively compressed explanations.
- Missing clinical conditions.
- Incorrect answer sets.
- Ambiguous clinical vignettes.
- Implausible distractors.
- Repetitive question patterns.
- Unsupported medical claims.
- Unnatural Vietnamese writing.

The examples must actually inform runtime prompt construction and evaluation.

Do not create a documentation-only example collection disconnected from application behavior.

Research, extend, and improve these examples independently.

---

# 9. Mistral Large 4 integration

Preserve the selected primary model direction.

Provider:

NVIDIA hosted inference API.

Model ID:

`mistralai/mistral-large-4-1t-a52b`

Base URL:

`https://integrate.api.nvidia.com/v1`

Endpoint:

`https://integrate.api.nvidia.com/v1/chat/completions`

Use the user's existing NVIDIA API key.

Do not require a new key unless actual model-access verification establishes that it is necessary.

Verify the current official model documentation:

https://build.nvidia.com/mistralai/mistral-large-4-1t-a52b/apireference

Use model-specific reasoning parameters.

The previously identified NVIDIA Mistral configuration uses `reasoning_effort`, including `high` for reasoning-enabled tasks.

Do not automatically retain Nemotron-specific `reasoning_budget` or `chat_template_kwargs.enable_thinking` parameters.

Verify actual hosted API behavior before finalizing the integration.

Independently optimize task-specific configuration, context budgets, output budgets, reasoning, timeout handling, and structured-response validation.

The selected model has not yet been qualified by authenticated medical and dental generation tests in this conversation.

Preserve the previous requirements to investigate AI reliability, particularly the reported account-specific AI busy behavior, if it remains unresolved.

---

# 10. Runtime Internet research and evidence

Preserve the requirement for appropriate Internet research and medical evidence verification.

The system should be able to use reliable external sources when educational enrichment or medical verification requires them.

However, the user no longer wants separate PDF-grounded and Evidence-enhanced mode selectors.

Instead, develop one integrated evidence policy.

The PDF remains the primary learning source.

External research may:

- Verify medically consequential claims.
- Clarify important uncertainties.
- Support clinically meaningful applications.
- Detect outdated or conflicting guidance.
- Improve explanations when appropriately sourced.

Clearly distinguish external evidence from the PDF's original teaching.

Prioritize relevant Vietnamese authorities and professional medical or dental references, supplemented by appropriate international guidelines and peer-reviewed literature.

Investigate suitable retrieval mechanisms, including PubMed and Europe PMC APIs.

Do not confuse model tool-calling capabilities with actual Internet access.

Do not fabricate search results, source links, or medical verification.

Do not send identifiable patient information or confidential material to external prototype inference or search services.

Margin remains an educational application, not a system for treating real patients.

---

# 11. Replace existing summaries and quizzes when regenerating

This is a new explicit user requirement.

The application should no longer accumulate multiple previously generated summaries and question banks for the same PDF as ordinary visible learning resources.

Each document should have:

- One current summary.
- One current question bank.

The same document may still have both resource types simultaneously.

The summary and quiz are independent resource identities.

## 11.1 Replacement semantics

When the user generates a new summary:

- Create and validate the new summary.
- Persist it successfully.
- Replace the previous current summary.
- Remove the superseded summary from the ordinary library and reading interface.

The current quiz must remain unchanged.

When the user generates a new question bank:

- Create and validate the new question bank.
- Persist it successfully.
- Replace the previous current question bank.
- Remove the superseded question bank from the ordinary library and reading interface.

The current summary must remain unchanged.

Do not accumulate unnecessary historical generated-resource versions.

## 11.2 Safe replacement lifecycle

Use a safe replacement mechanism.

The previously accepted result should remain available while its replacement is being generated.

If generation fails, validation fails, persistence fails, the connection is interrupted, or the user cancels, retain the existing current result.

Do not delete the existing artifact at the beginning of a generation operation.

Conceptually:

Existing accepted artifact\
→ Generate replacement candidate\
→ Validate candidate\
→ Persist candidate\
→ Publish new current artifact\
→ Retire and safely remove superseded artifact

The exact storage mechanism is independently improvable.

Google Drive does not automatically provide the transactional guarantees of a relational database.

Design appropriate consistency, recovery, and reconciliation behavior without introducing an additional hosted database.

Do not claim atomic replacement unless the implementation actually provides the required guarantee.

## 11.3 Worked example

Initial state:

Document A:

- Current summary: S1.
- Current quiz: Q1.

The user selects "Tạo lại tóm tắt".

While S2 is being generated, S1 remains available.

If S2 fails, the current summary remains S1.

If S2 is successfully generated, validated, and stored, it becomes the current summary.

The old S1 is superseded and removed.

Q1 remains unchanged.

The user then selects "Tạo lại trắc nghiệm".

The same replacement rule applies independently to Q1 and Q2.

The final state is:

- Current summary: S2.
- Current quiz: Q2.

No unnecessary list of S1, S2, Q1, Q2 historical resources should appear.

## 11.4 Quiz attempts and associated state

A regenerated quiz may contain different questions, answer options, identifiers, and answer keys.

Do not attach previous answers or scoring state to the newly generated quiz.

Initialize a valid new assessment state.

Handle existing attempt records deliberately.

Do not leave broken references, accidentally associate attempts with the replacement quiz, or erase unrelated learning progress.

Superseded quiz artifacts and quiz-specific dependent data may be cleaned up within the authorized replacement scope.

Any broader historical-data deletion requires appropriate authorization.

## 11.5 Concurrent generation and account isolation

Ensure that replacement is scoped to the correct:

- Authorized Google account.
- Source PDF.
- Resource type.
- Source document version.
- Generation operation.

Prevent an older, delayed generation request from unintentionally overwriting a newer accepted result.

Handle concurrent requests from two devices using the same account.

Preserve strict isolation between different Google accounts.

Do not remove an original PDF, another document's artifacts, Google credentials, or unrelated application data when replacing a generated resource.

## 11.6 Existing stored data

Inspect the actual Google Drive persistence schema and existing saved artifacts.

Develop appropriate compatibility or migration behavior.

Where multiple historical results already exist, identify the appropriate current resource according to a reliable rule.

Do not perform an indiscriminate migration-time deletion of historical user data.

Cleanup associated with an explicitly requested regeneration must remain within its intended document and resource scope.

---

# 12. User interface refinement

The user wants fewer controls and a cleaner learning experience.

The ordinary workflow should not expose:

- Multiple summary modes.
- Multiple quiz-generation modes.
- Manual context-window configuration.
- Reasoning-token budgets.
- Internal AI agent selections.
- Technical prompt settings.
- Arbitrary source chunk selection.
- Large collections of obsolete summaries or quizzes.

Provide appropriate Vietnamese labels.

A possible simplified document workspace is:

Tóm tắt tài liệu

Trắc nghiệm

When a current result exists:

Xem tóm tắt

Tạo lại tóm tắt

Làm trắc nghiệm

Tạo lại trắc nghiệm

These labels are illustrative.

Independently develop the most natural, polished interaction.

Retain meaningful processing feedback, understandable errors, cancellation or retry where appropriate, and clear indications when a newly generated resource replaces an existing one.

Make the interface exceptionally clean.

---

# 13. Verification requirements

Evaluate the actual implementation using genuine Vietnamese medical and dental learning PDFs.

Do not treat guideline-only tests, English general-purpose documents, mocked responses, or valid JSON as sufficient evidence of the intended educational quality.

Verify representative workflows:

- Open and continuously read an actual Vietnamese PDF.
- Identify its real major educational sections.
- Generate a structured Vietnamese summary for those sections.
- Generate a substantial Vietnamese question bank.
- Include theoretical and clinical questions where supported.
- Produce a majority of multiple-correct-answer questions.
- Verify answer keys and distractors against source evidence.
- Evaluate Vietnamese terminology and natural writing.
- Shuffle answer options correctly.
- Score multiple-response questions.
- Save the accepted learning resources.
- Successfully replace an existing summary.
- Successfully replace an existing quiz.
- Preserve the previous resource after a failed replacement.
- Preserve independent summary and quiz identities.
- Preserve data isolation between authorized accounts.

Evaluate Mistral integration using real authenticated requests where credentials and permissions are available.

Test whether long-document processing maintains appropriate coverage without unnecessary repetition or excessive compression.

Distinguish software verification, live model integration, educational quality evaluation, expert review, and physical iPhone testing.

Do not claim clinical validation without appropriate evidence.

---

# 14. Independent Work assignment

Continue the existing Margin upgrade using this new context.

First inspect the actual current workspace, repository, source implementation, canonical context, deployment, and relevant evaluation evidence.

Determine which parts of the previous upgrade are already implemented and which remain outstanding.

Integrate the new requirements into the owning project context and runtime rule system.

Remove superseded requirements for multiple user-facing modes.

Develop the Vietnamese educational standard substantially beyond the preliminary examples in this handoff.

Research additional authentic Vietnamese medical and dental learning materials, assessment methods, professional terminology, summary quality, question construction, and evidence verification.

Independently improve the agent responsibilities, context construction, prompts, instructions, rules, calibration examples, workflows, model integration, persistence mechanisms, and interface.

Implement the resulting system rather than stopping at research or documentation.

Use the existing repository and authorized deployment workflow.

Verify the actual delivered application.

Do not restart unrelated completed work.

Do not repeatedly ask for routine technical decisions.

Do not introduce unnecessary infrastructure.

Do not turn independent improvement into an endless research or redesign loop.

Report actual remaining blockers and limitations.

---

# FINAL DIRECTION

The product should become a focused Vietnamese medical and dental learning application.

The user does not want to configure many AI modes.

The user wants a system whose intelligence automatically adapts to the educational document.

Build the necessary sophistication inside the system while keeping the ordinary user experience simple.

Research deeply.

Develop substantive context.

Create carefully written agent instructions.

Develop detailed, evidence-informed rules.

Construct meaningful Vietnamese calibration examples.

Improve the underlying workflows.

Use Mistral Large 4 appropriately.

Generate accurate, comprehensive, section-aware summaries.

Generate diverse, source-grounded theoretical and clinical questions.

Prioritize multiple-correct-answer questions.

Adapt question quantity to the actual educational material.

Replace old generated resources safely when a new result succeeds.

Preserve Google Drive persistence, privacy, and the existing product boundaries.

**One learning mode. Vietnamese-first. Medical and dental specialization. High educational quality. Clean user experience.**

You are free to independently research, improve, and implement the mechanisms necessary to achieve these outcomes.

END OF CURRENT CONTEXT HANDOFF
