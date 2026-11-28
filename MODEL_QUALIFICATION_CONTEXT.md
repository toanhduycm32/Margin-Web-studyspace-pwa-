# MARGIN — MODEL QUALIFICATION & PERFORMANCE CONTEXT UPDATE

Historical handoff (27 November). The owner's 28 November workflow redesign, maintained in ARCHITECTURE.md, supersedes the Mistral-first investigation sequence and maximum quality assumptions below. Reuse the saved evidence; do not repeat the qualification campaign. STATUS.md identifies the current implementation and verification state.

## 1. New clarification from the project owner

The user has reviewed the latest AI quality and performance report.

The user does not require immediate AI generation.

A generation operation taking approximately 10–15 minutes is acceptable when it produces genuinely high-quality educational materials.

However, generation taking approximately one hour should not become the ordinary product experience.

Interpret approximately 15 minutes as the target end-to-end duration for an individual representative summary or assessment-generation operation, not as a timeout for every individual model request.

This is a product performance target to investigate and validate, not a universal guarantee for PDFs of arbitrary size.

Preserve educational quality, Vietnamese medical terminology, whole-document coverage, clinical reasoning, multiple-response questions, and reliable answer verification.

Do not lower educational standards merely to achieve faster completion.

## 2. Current primary model — investigate before replacing

The immediate priority is to determine whether Mistral Large 4 can actually perform Margin's intended educational tasks.

Current primary model direction:

`mistralai/mistral-large-4-1t-a52b`

Provider:

NVIDIA hosted inference API.

The latest report establishes that:

- A short Mistral request completed successfully.
- Longer educational requests exceeded the application's 150-second timeout.
- A streaming probe produced reasoning data and subsequently began producing final content but was stopped before completion.
- The observed Vietnamese-language and malformed-question failures primarily originated from Nemotron Lightning fallback.
- Mistral's actual completed educational-output quality remains insufficiently evaluated.

Therefore, do not conclude that Mistral is incapable of producing acceptable learning materials solely because the existing integration terminated its requests.

Distinguish:

- API connectivity.
- Model access.
- Inference configuration.
- Time to first reasoning data.
- Time to first final-answer content.
- Time to complete a response.
- Structured-output reliability.
- Educational quality.
- End-to-end workflow performance.

## 3. Controlled model qualification

First inspect the current implementation, saved evaluation fixtures, failed responses, model configuration, and latest repository revision.

Use the actual Vietnamese dental textbook and the representative source passages that previously caused failures.

Test Mistral directly without automatic fallback obscuring its results.

Conduct bounded diagnostic experiments outside the existing production-request timeout where appropriate and authorized.

Investigate model-specific reasoning settings, prompt size, context composition, output budgets, structured-output controls, streaming behavior, and task complexity.

Determine whether Mistral can successfully produce:

- An accurate Vietnamese section summary.
- A small group of theoretical medical or dental questions.
- A small group of clinical questions.
- Multiple-correct-answer questions.
- Complete and correctly structured answer explanations.
- Defensible answer keys supported by source evidence.

Progressively evaluate larger batches once smaller tasks succeed.

Measure actual completed outputs rather than treating HTTP success or reasoning-token generation as task completion.

Compare several representative attempts rather than relying on one successful or failed request.

Do not repeatedly execute unchanged failing experiments.

## 4. Model replacement authority

The user authorizes changing the primary model if evidence demonstrates that another model is more suitable.

Mistral Large 4 is no longer an immutable implementation requirement.

Potential alternative candidates include:

- GLM-5.3 Flash.
- MiniMax M3.1 Flash.
- Nemotron 3.5 Super VL 120B-A12B.
- Other suitable NVIDIA-hosted API models discovered through independent research.

These are candidates, not a closed list or mandatory integration roster.

Verify actual API access using the existing NVIDIA credential where supported.

Evaluate model suitability through real Vietnamese medical and dental workloads.

Do not select a model exclusively from parameter count, general benchmark scores, or advertised context capacity.

Do not automatically switch to Nemotron Lightning for critical educational generation when its output has not passed the applicable quality requirements.

A fallback model must be independently qualified for its assigned responsibility.

You may retain Mistral for selected reasoning tasks and use another model for generation or verification if evidence supports that architecture.

Prefer a simple, reliable model configuration over unnecessary multi-model complexity.

No new paid provider or infrastructure without user approval.

## 5. Workflow and performance engineering

Investigate whether the current workflow itself is creating unnecessary inference overhead.

The previous report identified a projected minimum of 296 provider calls for a 264-objective assessment under the current two-question batching strategy.

This creates a material performance and quota problem regardless of model quality.

Independently investigate and improve:

- Batch sizing.
- Context construction.
- Prompt efficiency.
- Reasoning allocation.
- Assessment planning.
- Structured-output contracts.
- Generation and verification scheduling.
- Appropriate parallelism within actual provider limits.
- Selective repair.
- Reuse of accepted intermediate results.
- Deterministic validation.
- Checkpoint persistence.
- Request and operation budgets.
- Long-document execution.

Do not assume every question requires a separate generation and verification request.

Equally, do not eliminate necessary medical verification solely to reduce API calls.

Research and select an appropriate balance based on actual output quality and performance.

Measure accepted questions per minute, successful summary coverage, total inference requests, retry rates, and total operation duration.

Optimize for completed and accepted educational artifacts rather than raw token throughput alone.

## 6. Background operation and recovery

The user accepts waiting because generation is intended to run without continuously interrupting reading.

Verify what background execution actually means in the current iPhone-first PWA and Vercel architecture.

Distinguish:

- Closing the learning panel while continuing to read.
- Switching to another application.
- Locking the iPhone.
- Closing the PWA.
- Losing network connectivity.
- Resuming a previously interrupted generation operation.

Do not promise continuous background execution if browser suspension or serverless runtime restrictions prevent it.

Improve durable checkpointing, recovery, progress reporting, and operation resumption within existing infrastructure.

Preserve the previous accepted summary or quiz until a replacement has been successfully generated, validated, and persisted.

## 7. Execution and decision

First establish whether Mistral Large 4 can produce acceptable educational outputs under an appropriate controlled configuration.

If Mistral succeeds, investigate whether its performance can meet the product's practical requirements through workflow optimization.

If Mistral remains unsuitable, independently qualify alternatives and select a better primary model.

Then improve and verify the integrated workflow using progressively larger educational inputs.

Preserve all previous Vietnamese medical and dental quality requirements, the unified learning mode, Google Drive persistence, account isolation, and clean user experience.

Do not restart unrelated completed work.

Do not stop at theoretical model comparisons.

Perform actual tests, make justified engineering decisions, implement the necessary improvements, and report the observed results.

Keep the current production version protected until the upgraded implementation has appropriate verification.

If the approximately 15-minute target is not achievable for a representative workload under the existing infrastructure and provider limits, report the measured limitation and viable trade-offs rather than manufacturing a successful result.

You have independent authority to research, configure, compare, replace, and optimize models and workflows within the established project restrictions.

END OF CONTEXT UPDATE
