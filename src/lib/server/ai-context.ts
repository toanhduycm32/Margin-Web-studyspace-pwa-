import { VIETNAMESE_STANDARD, VI_CALIBRATION } from "@/lib/shared/education";
import type { StudyDomain, SummaryProfile } from "@/lib/shared/study-rules";

export function domainContext(domain: StudyDomain): string {
  if (domain === "general") return "Use the source's own discipline and terminology. Do not invent clinical applications.";
  const field = domain === "dental" ? "dental and oral-health" : "medical";
  return `This is ${field} learning material, not a real patient consultation. Separate foundational facts, clinical observations, interpretation and management. Keep the source's population, time course, severity, units, thresholds, uncertainty, contraindications and exceptions whenever they change the answer. A plausible clinical vignette is allowed only if every medically consequential premise is explicitly supported by the supplied pages. Do not infer a treatment or diagnosis from incomplete findings. A dated or conflicting recommendation must be identified as the PDF's teaching, not silently presented as current guidance. Never fabricate a guideline, citation, drug dose or patient detail.`;
}

export function summaryContext(domain: StudyDomain, _profile: SummaryProfile): string {
  return `${domainContext(domain)} ${VIETNAMESE_STANDARD} ${VI_CALIBRATION.summary} Check that no omitted condition inverts a clinical conclusion. Missing extracted content is not evidence of absence.`;
}
export function assessmentContext(domain: StudyDomain): string {
  return `${domainContext(domain)} ${VIETNAMESE_STANDARD} ${VI_CALIBRATION.theory} ${domain === "general" ? "" : VI_CALIBRATION.clinical} Write original questions tied to the assigned objective. Test every option independently under the exact stem. Wrong options must be false under those conditions, not simply less relevant. Reject copied self-assessment wording, disguised repetition, unsupported assumptions and artificial difficulty. An application question needs a supported reasoning bridge.`;
}
export const CALIBRATION_EXAMPLES = "Select-all: at least two defensible correct options and one false option. Select-N: required count, answer key and explanation agree. Single-best: one defensible answer under an explicit decision criterion. Do not use letter-linked options, all/none shortcuts or unnecessary negative stems. Explain the violated condition in each distractor.";
