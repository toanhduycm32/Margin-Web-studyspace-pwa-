import type { StudyDomain, SummaryProfile } from "@/lib/shared/study-rules";

export function domainContext(domain: StudyDomain): string {
  if (domain === "general") return "Use the source's own discipline and terminology. Do not invent clinical applications.";
  const field = domain === "dental" ? "dental and oral-health" : "medical";
  return `This is ${field} learning material, not a real patient consultation. Separate foundational facts, clinical observations, interpretation and management. Keep the source's population, time course, severity, units, thresholds, uncertainty, contraindications and exceptions whenever they change the answer. A plausible clinical vignette is allowed only if every medically consequential premise is explicitly supported by the supplied pages. Do not infer a treatment or diagnosis from incomplete findings. A dated or conflicting recommendation must be identified as the PDF's teaching, not silently presented as current guidance. Never fabricate a guideline, citation, drug dose or patient detail.`;
}

export function summaryContext(domain: StudyDomain, profile: SummaryProfile): string {
  const profileFocus = profile === "clinical"
    ? "Organize supported presentation, reasoning, investigations and management; omit unsupported headings."
    : profile === "revision"
      ? "Prioritize recall-worthy distinctions and conditions with concise checkpoints."
      : profile === "deep"
        ? "Explain mechanisms, intermediate reasoning and relationships in depth."
        : profile === "concise"
          ? "Preserve the central meaning and critical qualifications in few words."
          : "Provide connected, explanatory coverage of the important source concepts.";
  return `${domainContext(domain)} ${profileFocus} In every section, check whether omissions would invert a clinical conclusion. Distinguish missing extracted content from a source claim that something is absent.`;
}

export function assessmentContext(domain: StudyDomain): string {
  const core = "Write original assessment items. First identify a source-backed learning objective; then design a stem with all conditions needed to decide the answer. For each option, test truth under exactly those conditions. Wrong options must be false, not merely less attractive. Keep answer explanations educational and tied to source evidence. Avoid copied exam-bank wording, unsupported distractors, and trivial recall when reasoning is available.";
  if (domain === "general") return core;
  return `${domainContext(domain)} ${core} Use a balanced mix of foundational understanding and clinically relevant reasoning where supported. Distinguish symptoms from diagnosis, indication from contraindication, and examination findings from management. Do not use a clinical action as a correct answer unless the population, setting and necessary exclusions are supported. A source-only question cannot claim external clinical consensus.`;
}

export const CALIBRATION_EXAMPLES = `Calibration examples describe answer logic, not facts to copy into generated items:
1. Source says "X occurs only when A and B are present." Objective: recognize conditions. Good select-all item asks which conclusions follow under explicit A/B states; wrong option claims X with A alone. Reject a wrong option that is merely less relevant but still true.
2. Dental source says "Finding P supports condition Q, but finding R requires a different assessment." Good vignette states P and R explicitly and asks what the source permits concluding. Reject a confident diagnosis or treatment that ignores R.
3. Medical source gives a test threshold for population G. Good interpretation item states G, units and timing. Reject applying the threshold to another population or omitting the units. If the source lacks those details, ask a narrower question.
4. For a select-N item, the stem names the required number, the key has exactly that many defensible options, and each unselected option is independently false under the stem. Never use "all of the above" or "none of the above".`;
