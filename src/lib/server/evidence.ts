import type { StudyDomain } from "@/lib/shared/study-rules";

export type EvidenceSource = { title: string; year: string; url: string; abstract: string };

// Only these public, broad topic strings leave the server. Never put PDF text, a patient
// vignette, a document title, or user data in the external search URL.
const topics: Array<{ match: RegExp; query: string; domain: StudyDomain }> = [
  { match: /(?<![\p{L}\p{N}_])(?:pulpitis|tủy răng)(?![\p{L}\p{N}_])/iu, query: "irreversible pulpitis", domain: "dental" },
  { match: /(?<![\p{L}\p{N}_])(?:caries|sâu răng)(?![\p{L}\p{N}_])/iu, query: "dental caries", domain: "dental" },
  { match: /(?<![\p{L}\p{N}_])(?:periodont\w*|nha chu)(?![\p{L}\p{N}_])/iu, query: "periodontal disease", domain: "dental" },
  { match: /(?<![\p{L}\p{N}_])(?:antibiotic\w*|kháng sinh)(?![\p{L}\p{N}_])/iu, query: "dental antibiotic prescribing", domain: "dental" },
  { match: /(?<![\p{L}\p{N}_])(?:iron deficiency|thiếu máu thiếu sắt)(?![\p{L}\p{N}_])/iu, query: "iron deficiency anemia", domain: "medical" },
  { match: /(?<![\p{L}\p{N}_])(?:hypertension|tăng huyết áp)(?![\p{L}\p{N}_])/iu, query: "hypertension management", domain: "medical" },
  { match: /(?<![\p{L}\p{N}_])(?:diabetes|đái tháo đường)(?![\p{L}\p{N}_])/iu, query: "diabetes mellitus management", domain: "medical" },
  { match: /(?<![\p{L}\p{N}_])(?:asthma|hen phế quản)(?![\p{L}\p{N}_])/iu, query: "asthma management", domain: "medical" },
];

export function publicEvidenceQuery(source: string, domain: StudyDomain): string | null {
  return topics.find((topic) => topic.domain === domain && topic.match.test(source.normalize("NFC")))?.query || null;
}

export async function retrieveEvidence(source: string, domain: StudyDomain): Promise<EvidenceSource[]> {
  const topic = publicEvidenceQuery(source, domain);
  if (!topic) return [];
  const url = new URL("https://www.ebi.ac.uk/europepmc/webservices/rest/search");
  url.searchParams.set("query", topic);
  url.searchParams.set("format", "json");
  url.searchParams.set("resultType", "core");
  url.searchParams.set("pageSize", "3");
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000), cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json() as { resultList?: { result?: Array<Record<string, unknown>> } };
    return (data.resultList?.result || []).filter((item) => item.source === "MED" &&
      typeof item.id === "string" && /^\d+$/.test(item.id) &&
      typeof item.title === "string" && typeof item.abstractText === "string" &&
      item.abstractText.length > 200).slice(0, 2).map((item) => ({
      title: String(item.title).slice(0, 250), year: String(item.pubYear || "").slice(0, 4),
      url: `https://europepmc.org/article/MED/${item.id}`,
      abstract: String(item.abstractText).replace(/<[^>]*>/g, " ").slice(0, 2000),
    }));
  } catch { return []; }
}

export function evidencePrompt(sources: EvidenceSource[]): string {
  if (!sources.length) return "No external research was retrieved. Do not imply that an external check occurred.";
  return `The following are external research abstracts, not the PDF and not complete clinical guidelines. They may help spot conflicts, but do not treat them as proof of a claim they do not contain. Never copy an abstract into an item. Preserve PDF-derived content separately.\n${sources.map((item, index) =>
    `${index + 1}. ${item.title} (${item.year}) ${item.url}\nAbstract: ${item.abstract}`).join("\n")}`;
}
