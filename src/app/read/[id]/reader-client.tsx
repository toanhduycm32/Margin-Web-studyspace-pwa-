"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { api, ApiError } from "@/lib/client/api";
import { extractTextPages, partitionSectionPages } from "@/lib/client/extract";
import { documentSections } from "@/lib/client/structure";
import { correctOptionIds, responseType } from "@/lib/shared/quiz";
import { newOptionOrders } from "@/lib/shared/attempt-order";
import { allocateQuizBlueprint, classifyStudyDomain, recommendedQuestionCount, sectionWordTarget, STUDY_RULE_VERSION, SUMMARY_PROFILES, type SummaryProfile } from "@/lib/shared/study-rules";
import type { ArtifactRecord, AttemptRecord, DocumentRecord, DriveFile, QuizQuestion, SignedMap } from "@/lib/shared/types";
import PageSurface from "./page-surface";
import SummaryContent from "./summary-content";

type ArtifactItem = { id: string; kind: string; sourceMd5: string; createdAt: string };
type Running = { stage: string; done: number; total: number };

function humanDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

export default function ReaderClient({ id }: { id: string }) {
  const router = useRouter();
  const [record, setRecord] = useState<DocumentRecord | null>(null);
  const [file, setFile] = useState<DriveFile | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [width, setWidth] = useState(760);
  const [near, setNear] = useState<Set<number>>(new Set([1, 2]));
  const [currentPage, setCurrentPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([]);
  const [active, setActive] = useState<ArtifactRecord | null>(null);
  const [answers, setAnswers] = useState<number[][]>([]);
  const [optionOrders, setOptionOrders] = useState<number[][]>([]);
  const [quizPage, setQuizPage] = useState(0);
  const [submitted, setSubmitted] = useState<AttemptRecord | null>(null);
  const [previousAttempt, setPreviousAttempt] = useState<AttemptRecord | null>(null);
  const [quizCount, setQuizCount] = useState(0);
  const [summaryStyle, setSummaryStyle] = useState<SummaryProfile>("academic");
  const [researchMode, setResearchMode] = useState(false);
  const [running, setRunning] = useState<Running | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const positionRef = useRef({ page: 1, offset: 0 });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [document, saved] = await Promise.all([
          api<{ record: DocumentRecord; file: DriveFile; changed: boolean }>(`/api/library/${encodeURIComponent(id)}`),
          api<{ artifacts: ArtifactItem[] }>(`/api/library/${encodeURIComponent(id)}/artifacts`),
        ]);
        if (cancelled) return;
        setRecord(document.record); setFile(document.file); setArtifacts(saved.artifacts);
        setCurrentPage(document.record.progress.page);
        positionRef.current = { page: document.record.progress.page, offset: document.record.progress.offset };
        if (document.changed) setNotice("This PDF changed in Drive. Older resources refer to its previous version.");
      } catch (caught) { if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not open this PDF."); }
    }
    void load();
    return () => { cancelled = true; abortRef.current?.abort(); };
  }, [id]);

  useEffect(() => {
    if (!file) return;
    const fileSize = Number(file.size);
    let cancelled = false;
    let task: { promise: Promise<PDFDocumentProxy>; destroy: () => Promise<void> } | null = null;
    let rangeFailure: Error | null = null;
    async function open() {
      try {
        const { openDrivePdf } = await import("@/lib/client/pdf-range");
        if (cancelled) return;
        task = openDrivePdf(id, fileSize, (failure) => {
          rangeFailure = failure;
          if (!cancelled) { setError(failure.message); setPdf(null); void task?.destroy(); }
        });
        const loaded = await task.promise;
        if (cancelled) { await loaded.destroy(); return; }
        setPdf(loaded);
      } catch (caught) { if (!cancelled) setError(rangeFailure ? (rangeFailure as Error).message :
        caught instanceof Error ? caught.message : "PDF could not be rendered."); }
    }
    void open();
    return () => { cancelled = true; void task?.destroy(); };
  }, [file?.id, id]);

  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.min(850, entry.contentRect.width))));
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [pdf]);

  useEffect(() => {
    if (!pdf) return;
    const observer = new IntersectionObserver((entries) => {
      setNear((old) => {
        const next = new Set(old);
        let changed = false;
        for (const entry of entries) {
          const number = Number((entry.target as HTMLElement).dataset.readerPage);
          if (entry.isIntersecting && !next.has(number)) { next.add(number); changed = true; }
          if (!entry.isIntersecting && next.delete(number)) changed = true;
        }
        return changed ? next : old;
      });
    }, { rootMargin: "900px 0px" });
    document.querySelectorAll("[data-reader-page]").forEach((element) => observer.observe(element));
    const restore = setTimeout(() => {
      const target = document.getElementById(`pdf-page-${Math.min(pdf.numPages, positionRef.current.page)}`);
      if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY +
        target.clientHeight * positionRef.current.offset - 90, behavior: "instant" });
    }, 200);
    return () => { clearTimeout(restore); observer.disconnect(); };
  }, [pdf]);

  useEffect(() => {
    if (!pdf || !record) return;
    let raf = 0;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const save = () => {
      void api(`/api/library/${encodeURIComponent(id)}`, {
        method: "PATCH", body: JSON.stringify(positionRef.current), keepalive: true,
      }).catch(() => {});
    };
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const element = document.elementFromPoint(window.innerWidth / 2, Math.min(window.innerHeight * 0.42, window.innerHeight - 50))
          ?.closest<HTMLElement>("[data-reader-page]");
        if (!element) return;
        const page = Number(element.dataset.readerPage);
        const rect = element.getBoundingClientRect();
        if (!Number.isInteger(page)) return;
        const offset = Math.max(0, Math.min(1, (window.innerHeight * 0.42 - rect.top) / Math.max(1, rect.height)));
        positionRef.current = { page, offset };
        setCurrentPage(page);
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(save, 1200);
      });
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") save(); };
    window.addEventListener("scroll", update, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("scroll", update); document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(raf); if (saveTimer) clearTimeout(saveTimer); save();
    };
  }, [pdf, record?.sourceId, id]);

  async function refreshArtifacts() {
    const result = await api<{ artifacts: ArtifactItem[] }>(`/api/library/${encodeURIComponent(id)}/artifacts`);
    setArtifacts(result.artifacts);
  }

  async function openArtifact(artifactId: string) {
    setError("");
    try {
      const result = await api<{ artifact: ArtifactRecord }>(`/api/artifacts/${artifactId}`);
      setActive(result.artifact); setSubmitted(null); setAnswers([]); setQuizPage(0); setSheetOpen(true);
      setOptionOrders(result.artifact.kind === "quiz" ? newOptionOrders((result.artifact.payload as { questions: QuizQuestion[] }).questions) : []);
      if (result.artifact.kind === "quiz") {
        const attempts = await api<{ attempts: AttemptRecord[] }>(`/api/artifacts/${artifactId}/attempts`);
        setPreviousAttempt(attempts.attempts[0] || null);
      } else setPreviousAttempt(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not open saved resource."); }
  }

  async function run(kind: "summary" | "quiz") {
    if (!pdf || !file?.md5Checksum || abortRef.current) return;
    const controller = new AbortController(); abortRef.current = controller;
    let requestedCount = kind === "quiz" ? quizCount : 0;
    const profile = kind === "summary" ? summaryStyle : undefined;
    let operationKey = "";
    setActive(null); setError(""); setNotice(""); setSheetOpen(true);
    setRunning({ stage: "Preparing your PDF", done: 0, total: 1 });
    try {
      const config = await api<{ missing: string[] }>("/api/config");
      if (config.missing.includes("NVIDIA_API_KEY")) throw new Error("Add NVIDIA_API_KEY to .env.local before using AI.");
      setRunning({ stage: "Reading every page", done: 0, total: pdf.numPages });
      const pages = await extractTextPages(pdf, (done, total) => setRunning({ stage: "Reading every page", done, total }), controller.signal);
      const sections = await documentSections(pdf, pages);
      const chunks = partitionSectionPages(pages, sections);
      const planning = chunks.map((chunk) => ({
        sectionId: chunk.section!.id,
        characters: chunk.text.replace(/^Page \d+\n/gm, "").replace(/\[No extractable text\]/g, "").trim().length < 40
          ? 0 : chunk.text.length,
        conceptSignals: (chunk.text.match(/\b(?:means|defined as|because|therefore|assum|theorem|formula|diagnos|symptom|treatment|contraindicat|định nghĩa|giả sử|chẩn đoán|điều trị|triệu chứng)\b/gi) || []).length,
      }));
      if (kind === "quiz" && quizCount === 0) requestedCount = recommendedQuestionCount(planning);
      if (kind === "quiz" && requestedCount < 5) throw new Error("This PDF has too little readable material for a reliable quiz.");
      const evidenceMode = researchMode ? "research" : "pdf";
      operationKey = `margin-ai-${STUDY_RULE_VERSION}-${id}-${file.md5Checksum}-${kind}-${requestedCount}-${profile || ""}-${evidenceMode}`;
      const operationId = sessionStorage.getItem(operationKey) || crypto.randomUUID();
      sessionStorage.setItem(operationKey, operationId);
      const sectionSizes = new Map(sections.map((section) => [section.id,
        chunks.filter((chunk) => chunk.section?.id === section.id).reduce((sum, chunk) => sum + chunk.text.length, 0)]));
      const domain = classifyStudyDomain(chunks.map((chunk) => chunk.text.slice(0, 2500)).join(" "));
      const blueprint = kind === "quiz" ? allocateQuizBlueprint(planning, requestedCount, domain) : [];
      const signed: SignedMap[] = [];
      for (let index = 0; index < chunks.length; index++) {
        if (controller.signal.aborted) throw new Error("Processing stopped. Retry to reuse completed work.");
        setRunning({ stage: kind === "summary" ? "Writing section summaries" : "Building your assessment", done: index, total: chunks.length });
        const chunk = chunks[index];
        const sectionSize = sectionSizes.get(chunk.section!.id) || chunk.text.length;
        const wordTarget = profile ? Math.max(20, Math.round(sectionWordTarget(profile, sectionSize) * chunk.text.length / sectionSize)) : undefined;
        const body = JSON.stringify({ kind, operationId, documentId: id, sourceMd5: file.md5Checksum,
          chunkIndex: index, chunkCount: chunks.length, startPage: chunk.startPage, endPage: chunk.endPage,
          pageCount: pdf.numPages, requestedCount, emptyPages: chunk.emptyPages, text: chunk.text,
          section: chunk.section, summaryProfile: profile, wordTarget, evidenceMode,
          plannedFormats: kind === "quiz" ? blueprint[index].formats : undefined,
          plannedFamilies: kind === "quiz" ? blueprint[index].families : undefined });
        let result: SignedMap | null = null;
        for (let retry = 0; retry < 4; retry++) {
          try { result = await api<SignedMap>("/api/ai/chunk", { method: "POST", signal: controller.signal, body }); break; }
          catch (caught) {
            if (!(caught instanceof ApiError) || caught.status !== 503 || retry === 3 || controller.signal.aborted) throw caught;
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(resolve, 800 * 2 ** retry);
              controller.signal.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("Processing stopped.")); }, { once: true });
            });
          }
        }
        if (!result) throw new Error("Processing segment did not complete.");
        signed.push(result);
      }
      setRunning({ stage: kind === "summary" ? "Saving your summary" : "Saving your quiz", done: chunks.length, total: chunks.length });
      const result = await api<{ artifact: ArtifactRecord }>("/api/ai/finalize", { method: "POST", signal: controller.signal,
        body: JSON.stringify({ kind, operationId, documentId: id, sourceMd5: file.md5Checksum, requestedCount,
          summaryProfile: profile, evidenceMode, maps: signed }),
      });
      sessionStorage.removeItem(operationKey);
      setActive(result.artifact); setAnswers([]); setSubmitted(null); setPreviousAttempt(null); setQuizPage(0);
      setOptionOrders(result.artifact.kind === "quiz" ? newOptionOrders((result.artifact.payload as { questions: QuizQuestion[] }).questions) : []);
      let refreshed = true;
      try { await refreshArtifacts(); } catch { refreshed = false; }
      setNotice(refreshed ? `${kind === "summary" ? "Summary" : "Quiz"} saved to your Google Drive.` :
        "Resource saved to Drive. Reopen the PDF to refresh the saved list.");
    } catch (caught) {
      if (operationKey && caught instanceof Error && /Repeated assessment items|blueprint could not be completed/.test(caught.message)) {
        sessionStorage.removeItem(operationKey);
      }
      setError(controller.signal.aborted ? "Processing stopped. Start again to reuse completed work." :
      caught instanceof Error ? caught.message : "Whole-PDF processing failed."); }
    finally { abortRef.current = null; setRunning(null); }
  }

  async function submitQuiz() {
    if (!active || active.kind !== "quiz") return;
    const questions = (active.payload as { questions: QuizQuestion[] }).questions;
    const missing = questions.findIndex((question, index) => !answers[index]?.length ||
      responseType(question) === "select_n" && answers[index].length !== (question as { selectionCount: number }).selectionCount);
    if (missing >= 0) { setQuizPage(Math.floor(missing / 10)); setError(`Answer question ${missing + 1} before submitting.`); return; }
    setError("");
    try {
      const result = await api<{ attempt: AttemptRecord }>(`/api/artifacts/${active.id}/attempts`, {
        method: "POST", body: JSON.stringify({ answers }),
      });
      setSubmitted(result.attempt); setPreviousAttempt(result.attempt);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save quiz attempt."); }
  }

  if (!record || !file) return <main className="reader-loading"><button className="text-link" onClick={() => router.push("/")}>← Library</button><h1>{error || "Opening PDF…"}</h1></main>;
  const questions = active?.kind === "quiz" ? (active.payload as { questions: QuizQuestion[] }).questions : [];
  const quizPageCount = Math.ceil(questions.length / 10);
  const answeredCount = questions.filter((question, index) => (answers[index] || []).length > 0 &&
    (responseType(question) !== "select_n" || (answers[index] || []).length === ("selectionCount" in question ? question.selectionCount : 1))).length;
  const chooseAnswer = (question: QuizQuestion, questionIndex: number, optionIndex: number) => {
    setAnswers((old) => {
      const next = [...old];
      if (responseType(question) === "single_best") next[questionIndex] = [optionIndex];
      else {
        const selected = next[questionIndex] || [];
        if (selected.includes(optionIndex)) next[questionIndex] = selected.filter((id) => id !== optionIndex);
        else if (responseType(question) !== "select_n" || selected.length < ("selectionCount" in question ? question.selectionCount! : 1)) {
          next[questionIndex] = [...selected, optionIndex].sort((a, b) => a - b);
        }
      }
      return next;
    });
  };

  return <div className="reader-shell"><header className="reader-top"><button className="reader-back" onClick={() => router.push("/")} aria-label="Back to library">← <span>Library</span></button><div className="reader-name" title={file.name}>{file.name}</div><div className="reader-top-actions"><span className="current-page">{currentPage}{pdf ? ` / ${pdf.numPages}` : ""}</span><button className="reader-study" onClick={() => setSheetOpen(true)}>✦ <span>Study</span></button></div></header>
    {notice && <div className="reader-alert notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notice">×</button></div>}
    {error && !sheetOpen && <div className="reader-alert error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
    {!pdf ? <div className="reader-loading-inline">{error ? <button className="button secondary" onClick={() => window.location.reload()}>Retry opening PDF</button> : "Opening the original PDF…"}</div> : <main className="pdf-flow" ref={contentRef}>{Array.from({ length: pdf.numPages }, (_, index) => <PageSurface key={index + 1} pdf={pdf} number={index + 1} width={width} active={near.has(index + 1)} />)}</main>}
    {sheetOpen && <><button className="sheet-backdrop" aria-label="Close study panel" onClick={() => setSheetOpen(false)} /><aside className="study-sheet" aria-label="PDF study tools"><div className="sheet-header"><div><span className="eyebrow">THIS PDF</span><h2>{active ? active.kind === "summary" ? "Summary" : "Practice quiz" : "Study the whole book"}</h2></div><button className="sheet-close" aria-label="Close study panel" onClick={() => setSheetOpen(false)}>×</button></div><div className="sheet-body">
      {error && <div className="alert error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
      {running ? <div className="processing"><div className="processing-symbol">✦</div><h3>{running.stage}</h3><p>{running.stage === "Reading every page" ? `${running.done} of ${running.total} pages` : `${Math.round(running.done / Math.max(1, running.total) * 100)}% complete`}</p><div className="progress-track"><div style={{ width: `${Math.round(running.done / Math.max(1, running.total) * 100)}%` }} /></div><p className="quiet">You can close this panel and keep reading. Completed work is saved if processing is interrupted.</p><button className="text-link" onClick={() => abortRef.current?.abort()}>Stop processing</button></div> : active ? <>
        <button className="text-link back-to-tools" onClick={() => { setActive(null); setAnswers([]); setSubmitted(null); }}>← All study tools</button>
        <p className="resource-meta">Created {humanDate(active.createdAt)} · {active.readablePages}/{active.pageCount} pages had extractable text{active.sourceMd5 !== file.md5Checksum ? " · Earlier PDF version" : ""}</p>
        {active.evidenceMode === "research" && <div className="coverage-warning">External research was requested. {active.evidenceReferences?.length
          ? <>These abstracts were consulted as a limited cross-check; they do not verify every claim: {active.evidenceReferences.map((reference, index) =>
            <span key={reference.url}>{index ? "; " : ""}<a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.title} ({reference.year})</a></span>)}</>
          : "No relevant public abstracts were retrieved; this resource uses the PDF alone."}</div>}
        {active.emptyPages.length > 0 && <p className="coverage-warning">Text could not be extracted from {active.emptyPages.length} page{active.emptyPages.length === 1 ? "" : "s"}. Images, diagrams and scans were not interpreted.</p>}
        {active.kind === "quiz" && active.sections && active.assessedSectionIds && active.assessedSectionIds.length < active.sections.length &&
          <p className="coverage-warning">This quiz samples {active.assessedSectionIds.length} of {active.sections.length} identified sections. A finite quiz cannot test every concept.</p>}
        {active.kind === "summary" ? <SummaryContent text={(active.payload as { text: string }).text} /> : <div className="quiz-body">{previousAttempt && !submitted && <p className="previous-attempt">Last attempt: {previousAttempt.score}/{previousAttempt.questionCount} · {humanDate(previousAttempt.createdAt)}</p>}
          {submitted && <div className="quiz-score"><strong>{submitted.score}/{submitted.questionCount}</strong><span>correct answers</span></div>}
          <p className="resource-meta">Answered {answeredCount} of {questions.length}</p>
          {questions.slice(quizPage * 10, quizPage * 10 + 10).map((question, offset) => {
            const index = quizPage * 10 + offset;
            const selected = answers[index] || [];
            const correct = correctOptionIds(question);
            const format = responseType(question);
            const isCorrect = selected.length === correct.length && selected.every((id) => correct.includes(id));
            const displayOrder = optionOrders[index] || question.options.map((_, optionIndex) => optionIndex);
            return <section className="quiz-question" key={"id" in question ? question.id : index}>
              <div className="question-kicker">QUESTION {index + 1} OF {questions.length} · PAGES {question.startPage}–{question.endPage}</div>
              <h3>{question.question}</h3>
              <p className="question-instruction">{format === "single_best" ? "Choose one best answer" : format === "select_n"
                ? `Select exactly ${"selectionCount" in question ? question.selectionCount : correct.length} answers`
                : "Select all that apply"}</p>
              <div className="quiz-options">{displayOrder.map((optionIndex, displayIndex) => <label key={optionIndex}
                className={`quiz-option ${selected.includes(optionIndex) ? "chosen" : ""} ${submitted && correct.includes(optionIndex) ? "correct" : ""} ${submitted && selected.includes(optionIndex) && !correct.includes(optionIndex) ? "incorrect" : ""}`}>
                <input type={format === "single_best" ? "radio" : "checkbox"} name={`question-${index}`}
                  checked={selected.includes(optionIndex)} disabled={!!submitted}
                  onChange={() => chooseAnswer(question, index, optionIndex)} />
                <span className="option-letter">{String.fromCharCode(65 + displayIndex)}</span>
                <span>{question.options[optionIndex]}{submitted && "optionExplanations" in question && <small className="option-feedback">{question.optionExplanations[optionIndex]}</small>}</span>
              </label>)}</div>
              {submitted && <div className="answer-explanation"><strong>{isCorrect ? "Correct" :
                `Correct choices: ${correct.map((id) => String.fromCharCode(65 + displayOrder.indexOf(id))).join(", ")}`}</strong>
                <p>{question.explanation}</p><small>Source: “{question.sourceExcerpt}”</small></div>}
            </section>;
          })}
          {quizPageCount > 1 && <div className="quiz-pagination"><button className="button secondary" onClick={() => setQuizPage((page) => Math.max(0, page - 1))} disabled={quizPage === 0}>← Previous</button><span>{quizPage + 1} / {quizPageCount}</span><button className="button secondary" onClick={() => setQuizPage((page) => Math.min(quizPageCount - 1, page + 1))} disabled={quizPage >= quizPageCount - 1}>Next →</button></div>}
          {!submitted ? quizPage === quizPageCount - 1 && <button className="button primary full" onClick={() => void submitQuiz()}>Submit answers</button> : <button className="button secondary full" onClick={() => { setAnswers([]); setSubmitted(null); setQuizPage(0); setOptionOrders(newOptionOrders(questions, optionOrders)); }}>Try again</button>}
        </div>}
      </> : <><p className="sheet-intro">Choose one action. Margin reads every page automatically, then saves the result beside this PDF.</p><div className="study-actions"><div className="quiz-choice"><label htmlFor="summary-style">Summary style</label><select id="summary-style" value={summaryStyle} onChange={(event) => setSummaryStyle(event.target.value as SummaryProfile)}>{Object.entries(SUMMARY_PROFILES).map(([id, rule]) => <option key={id} value={id}>{rule.label}</option>)}</select></div><button className="study-action" onClick={() => void run("summary")} disabled={!pdf}><span className="action-glyph">≡</span><span><strong>Summarize PDF</strong><small>Section by section, across the whole document</small></span><b>→</b></button><div className="quiz-choice"><label htmlFor="quiz-count">Practice questions</label><select id="quiz-count" value={quizCount} onChange={(event) => setQuizCount(Number(event.target.value))}><option value={0}>Suggested for this PDF</option>{[5, 10, 20, 30, 50, 75, 100, 150, 200, 300].map((count) => <option key={count} value={count}>{count} questions</option>)}</select></div><button className="study-action" onClick={() => void run("quiz")} disabled={!pdf}><span className="action-glyph">?</span><span><strong>Generate quiz</strong><small>Varied questions across the PDF</small></span><b>→</b></button></div><label className="quiz-choice research-choice"><input type="checkbox" checked={researchMode} onChange={(event) => setResearchMode(event.target.checked)} /> Check public medical or dental research when a supported topic is found</label><p className="privacy-note">Extracted PDF text is sent to NVIDIA when you start an action. Research mode searches only a fixed list of broad topics, never PDF text. Scanned pages and visual content may be missed. Large banks take longer and use more AI quota.</p><div className="saved-heading"><h3>Saved for this PDF</h3><span>{artifacts.length}</span></div>{artifacts.length ? <div className="saved-list">{artifacts.map((item) => <button key={item.id} className="saved-row" onClick={() => void openArtifact(item.id)}><span>{item.kind === "summary" ? "≡" : "?"}</span><div><strong>{item.kind === "summary" ? "Summary" : "Practice quiz"}</strong><small>{item.createdAt ? humanDate(item.createdAt) : "Saved"}{item.sourceMd5 !== file.md5Checksum ? " · Earlier PDF version" : ""}</small></div><b>→</b></button>)}</div> : <p className="quiet">Your summaries and quizzes will appear here.</p>}</>}
    </div></aside></>}
  </div>;
}
