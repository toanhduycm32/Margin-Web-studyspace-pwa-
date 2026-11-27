import { afterEach, describe, expect, it, vi } from "vitest";
import { generateChunkQuestions, summarizeChunk } from "./nvidia";
import { AppError } from "./errors";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("NVIDIA reasoning request", () => {
  it("sends the source through a server-only reasoning-enabled request", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
    const digest = "This section defines the topic, describes its mechanism, relates it to the broader course, and notes its limits in enough detail for study.";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ digest }) } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await summarizeChunk("A source passage about a mechanism and its limits.", 1, 2,
      "academic", "Introduction", "heading", 50, async () => {})).toBe(digest);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    const body = JSON.parse(String(options.body));
    expect(body.model).toBe("mistralai/mistral-large-4-1t-a52b");
    expect(body.reasoning_effort).toBe("high");
    expect(body.chat_template_kwargs).toBeUndefined();
    expect(body.stream).toBe(false);
  });
  it("reserves a call again before retrying malformed model output", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
    const digest = "This section defines the topic, describes its mechanism, relates it to the broader course, and notes its limits in enough detail for study.";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ choices: [{ finish_reason: "stop", message: { content: "not-json" } }] }))
      .mockResolvedValueOnce(Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ digest }) } }] })));
    const reserve = vi.fn(async () => {});
    expect(await summarizeChunk("A passage about a mechanism and its limits.", 1, 1,
      "academic", "Introduction", "heading", 50, reserve)).toBe(digest);
    expect(reserve).toHaveBeenCalledTimes(2);
  });
  it("regenerates a structurally valid item rejected by the independent answer audit", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
    const source = "The cell membrane controls movement of substances into and out of the cell.";
    const question = { response_type: "single_best", question_family: "definition", cognitive_demand: "understand",
      difficulty: "foundational", question: "Which statement describes the cell membrane?",
      options: ["It controls movement of substances.", "It produces sunlight for the cell.",
        "It stores every genetic instruction.", "It is a kind of digestive enzyme."],
      correct_option_ids: [0], selection_count: null,
      explanation: "The membrane regulates movement across the cell boundary, which is the function stated in the source.",
      option_explanations: ["Correct because the source states this function.", "Incorrect; this is not a membrane function.",
        "Incorrect; this describes genetic storage.", "Incorrect; a membrane is not an enzyme."],
      source_excerpt: "controls movement of substances" };
    const completion = (content: object) => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }] });
    const fetchMock = vi.fn().mockResolvedValueOnce(completion({ questions: [question] }))
      .mockResolvedValueOnce(completion({ valid: false, issues: ["The stem is ambiguous."] }))
      .mockResolvedValueOnce(completion({ questions: [question] }))
      .mockResolvedValueOnce(completion({ valid: true, issues: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const reserve = vi.fn(async () => {});
    const result = await generateChunkQuestions(source, ["single_best"], ["definition"], 1, 1, "Cells", reserve);
    expect(result).toHaveLength(1);
    expect(reserve).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const retry = JSON.parse(String((fetchMock.mock.calls[2][1] as RequestInit).body));
    expect(retry.messages[1].content).toContain("The stem is ambiguous.");
  });
  it("repairs one rejected item and audits the bank again", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
    const source = "The cell membrane controls movement of substances into and out of the cell.";
    const item = { response_type: "single_best", question_family: "definition", cognitive_demand: "understand",
      difficulty: "foundational", question: "Which statement describes the cell membrane?",
      options: ["It controls movement of substances.", "It produces sunlight for the cell.",
        "It stores every genetic instruction.", "It is a kind of digestive enzyme."],
      correct_option_ids: [0], selection_count: null,
      explanation: "The membrane regulates movement across the cell boundary, which is the function stated in the source.",
      option_explanations: ["Correct because the source states this function.", "Incorrect; this is not a membrane function.",
        "Incorrect; this describes genetic storage.", "Incorrect; a membrane is not an enzyme."],
      source_excerpt: "controls movement of substances" };
    const completion = (content: object) => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }] });
    const fetchMock = vi.fn().mockResolvedValueOnce(completion({ questions: [item] }))
      .mockResolvedValueOnce(completion({ valid: false, issues: [{ index: 1, reason: "Replace a distractor." }] }))
      .mockResolvedValueOnce(completion({ questions: [{ ...item, question: "Which function is attributed to the cell membrane?" }] }))
      .mockResolvedValueOnce(completion({ valid: true, issues: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateChunkQuestions(source, ["single_best"], ["definition"], 1, 1, "Cells", async () => {});
    expect(result[0].question).toContain("Which function");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const repair = JSON.parse(String((fetchMock.mock.calls[2][1] as RequestInit).body));
    expect(repair.messages[1].content).toContain("Replace only item 1");
    expect(repair.messages[1].content).toContain('"correct_option_ids"');
    expect(repair.messages[1].content).toContain('"option_explanations"');
  });
  it("does not retry a user's quota rejection as a provider outage", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const reserve = vi.fn().mockRejectedValue(new AppError(429, "Daily quota reached."));
    await expect(summarizeChunk("A source passage about a mechanism and its limits.", 1, 1,
      "academic", "Introduction", "heading", 50, reserve)).rejects.toThrow("Daily quota reached.");
    expect(reserve).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("uses the legacy model when Mistral times out and reserves both calls", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-key-only");
    const digest = "This section defines the topic, describes its mechanism, relates it to the broader course, and notes its limits in enough detail for study.";
    const fetchMock = vi.fn().mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"))
      .mockResolvedValueOnce(Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ digest }) } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const reserve = vi.fn(async () => {});
    const models: string[] = [];
    expect(await summarizeChunk("A source passage about a mechanism and its limits.", 1, 1,
      "academic", "Introduction", "heading", 50, reserve, undefined, [], (model) => models.push(model))).toBe(digest);
    expect(reserve).toHaveBeenCalledTimes(2);
    expect(models).toEqual(["nvidia/nemotron-3.5-lightning-30b-a3b"]);
    const fallback = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body));
    expect(fallback.chat_template_kwargs.enable_thinking).toBe(true);
  });
});
