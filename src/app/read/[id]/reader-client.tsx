"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { api } from "@/lib/client/api";
import { extractWholePdf } from "@/lib/client/extract";
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
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState<AttemptRecord | null>(null);
  const [previousAttempt, setPreviousAttempt] = useState<AttemptRecord | null>(null);
  const [quizCount, setQuizCount] = useState<5 | 10 | 20 | 30>(10);
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
      setActive(result.artifact); setSubmitted(null); setAnswers([]); setSheetOpen(true);
      if (result.artifact.kind === "quiz") {
        const attempts = await api<{ attempts: AttemptRecord[] }>(`/api/artifacts/${artifactId}/attempts`);
        setPreviousAttempt(attempts.attempts[0] || null);
      } else setPreviousAttempt(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not open saved resource."); }
  }

  async function run(kind: "summary" | "quiz") {
    if (!pdf || !file?.md5Checksum || running) return;
    const controller = new AbortController(); abortRef.current = controller;
    const requestedCount = kind === "quiz" ? quizCount : 0;
    setActive(null); setError(""); setNotice(""); setSheetOpen(true);
    try {
      const config = await api<{ missing: string[] }>("/api/config");
      if (config.missing.includes("NVIDIA_API_KEY")) throw new Error("Add NVIDIA_API_KEY to .env.local before using AI.");
      setRunning({ stage: "Reading every page", done: 0, total: pdf.numPages });
      const chunks = await extractWholePdf(pdf, (done, total) => setRunning({ stage: "Reading every page", done, total }), controller.signal);
      const signed: SignedMap[] = [];
      for (let index = 0; index < chunks.length; index++) {
        if (controller.signal.aborted) throw new Error("Processing stopped. Completed sections were saved for a later retry.");
        setRunning({ stage: "Studying the full PDF", done: index, total: chunks.length });
        const chunk = chunks[index];
        signed.push(await api<SignedMap>("/api/ai/chunk", { method: "POST", signal: controller.signal,
          body: JSON.stringify({ kind, documentId: id, sourceMd5: file.md5Checksum,
            chunkIndex: index, chunkCount: chunks.length, startPage: chunk.startPage, endPage: chunk.endPage,
            pageCount: pdf.numPages, requestedCount, emptyPages: chunk.emptyPages, text: chunk.text }),
        }));
      }
      setRunning({ stage: kind === "summary" ? "Writing your summary" : "Assembling your quiz", done: chunks.length, total: chunks.length });
      const result = await api<{ artifact: ArtifactRecord }>("/api/ai/finalize", { method: "POST", signal: controller.signal,
        body: JSON.stringify({ kind, documentId: id, sourceMd5: file.md5Checksum, requestedCount, maps: signed }),
      });
      setActive(result.artifact); setAnswers([]); setSubmitted(null); setPreviousAttempt(null);
      let refreshed = true;
      try { await refreshArtifacts(); } catch { refreshed = false; }
      setNotice(refreshed ? `${kind === "summary" ? "Summary" : "Quiz"} saved to your Google Drive.` :
        "Resource saved to Drive. Reopen the PDF to refresh the saved list.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Whole-PDF processing failed."); }
    finally { abortRef.current = null; setRunning(null); }
  }

  async function submitQuiz() {
    if (!active || active.kind !== "quiz") return;
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

  return <div className="reader-shell"><header className="reader-top"><button className="reader-back" onClick={() => router.push("/")} aria-label="Back to library">← <span>Library</span></button><div className="reader-name" title={file.name}>{file.name}</div><div className="reader-top-actions"><span className="current-page">{currentPage}{pdf ? ` / ${pdf.numPages}` : ""}</span><button className="reader-study" onClick={() => setSheetOpen(true)}>✦ <span>Study</span></button></div></header>
    {notice && <div className="reader-alert notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notice">×</button></div>}
    {error && !sheetOpen && <div className="reader-alert error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
    {!pdf ? <div className="reader-loading-inline">{error ? <button className="button secondary" onClick={() => window.location.reload()}>Retry opening PDF</button> : "Opening the original PDF…"}</div> : <main className="pdf-flow" ref={contentRef}>{Array.from({ length: pdf.numPages }, (_, index) => <PageSurface key={index + 1} pdf={pdf} number={index + 1} width={width} active={near.has(index + 1)} />)}</main>}
    {sheetOpen && <><button className="sheet-backdrop" aria-label="Close study panel" onClick={() => setSheetOpen(false)} /><aside className="study-sheet" aria-label="PDF study tools"><div className="sheet-header"><div><span className="eyebrow">THIS PDF</span><h2>{active ? active.kind === "summary" ? "Summary" : "Practice quiz" : "Study the whole book"}</h2></div><button className="sheet-close" aria-label="Close study panel" onClick={() => setSheetOpen(false)}>×</button></div><div className="sheet-body">
      {error && <div className="alert error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
      {running ? <div className="processing"><div className="processing-symbol">✦</div><h3>{running.stage}</h3><p>{running.done} of {running.total} {running.stage === "Reading every page" ? "pages" : "sections"}</p><div className="progress-track"><div style={{ width: `${Math.round(running.done / Math.max(1, running.total) * 100)}%` }} /></div><p className="quiet">You can close this panel and keep reading. Completed sections are saved if processing is interrupted.</p><button className="text-link" onClick={() => abortRef.current?.abort()}>Stop processing</button></div> : active ? <>
        <button className="text-link back-to-tools" onClick={() => { setActive(null); setAnswers([]); setSubmitted(null); }}>← All study tools</button>
        <p className="resource-meta">Created {humanDate(active.createdAt)} · {active.readablePages}/{active.pageCount} pages had extractable text{active.sourceMd5 !== file.md5Checksum ? " · Earlier PDF version" : ""}</p>
        {active.emptyPages.length > 0 && <p className="coverage-warning">Text could not be extracted from {active.emptyPages.length} page{active.emptyPages.length === 1 ? "" : "s"}. Images, diagrams and scans were not interpreted.</p>}
        {active.kind === "summary" ? <SummaryContent text={(active.payload as { text: string }).text} /> : <div className="quiz-body">{previousAttempt && !submitted && <p className="previous-attempt">Last attempt: {previousAttempt.score}/{previousAttempt.questionCount} · {humanDate(previousAttempt.createdAt)}</p>}
          {submitted && <div className="quiz-score"><strong>{submitted.score}/{submitted.questionCount}</strong><span>correct answers</span></div>}
          {questions.map((question, index) => <section className="quiz-question" key={index}><div className="question-kicker">QUESTION {index + 1} OF {questions.length} · PAGES {question.startPage}–{question.endPage}</div><h3>{question.question}</h3><div className="quiz-options">{question.options.map((option, optionIndex) => <label key={optionIndex} className={`quiz-option ${answers[index] === optionIndex ? "chosen" : ""} ${submitted && question.answer === optionIndex ? "correct" : ""} ${submitted && answers[index] === optionIndex && question.answer !== optionIndex ? "incorrect" : ""}`}><input type="radio" name={`question-${index}`} checked={answers[index] === optionIndex} disabled={!!submitted} onChange={() => setAnswers((old) => { const copy = [...old]; copy[index] = optionIndex; return copy; })} /><span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span><span>{option}</span></label>)}</div>{submitted && <div className="answer-explanation"><strong>{answers[index] === question.answer ? "Correct" : `Correct answer: ${String.fromCharCode(65 + question.answer)}`}</strong><p>{question.explanation}</p><small>Source: “{question.sourceExcerpt}”</small></div>}</section>)}
          {!submitted ? <button className="button primary full" onClick={() => void submitQuiz()}>Submit answers</button> : <button className="button secondary full" onClick={() => { setAnswers([]); setSubmitted(null); }}>Try again</button>}
        </div>}
      </> : <><p className="sheet-intro">Choose one action. Margin reads every page automatically, then saves the result beside this PDF.</p><div className="study-actions"><button className="study-action" onClick={() => void run("summary")} disabled={!pdf}><span className="action-glyph">≡</span><span><strong>Summarize PDF</strong><small>Key ideas from the whole document</small></span><b>→</b></button><div className="quiz-choice"><label htmlFor="quiz-count">Practice questions</label><select id="quiz-count" value={quizCount} onChange={(event) => setQuizCount(Number(event.target.value) as 5 | 10 | 20 | 30)}><option value={5}>5 questions</option><option value={10}>10 questions</option><option value={20}>20 questions</option><option value={30}>30 questions</option></select></div><button className="study-action" onClick={() => void run("quiz")} disabled={!pdf}><span className="action-glyph">?</span><span><strong>Generate quiz</strong><small>Practice across the entire PDF</small></span><b>→</b></button></div><p className="privacy-note">Extracted PDF text is sent to NVIDIA when you start an action. Scanned pages and visual content may be missed.</p><div className="saved-heading"><h3>Saved for this PDF</h3><span>{artifacts.length}</span></div>{artifacts.length ? <div className="saved-list">{artifacts.map((item) => <button key={item.id} className="saved-row" onClick={() => void openArtifact(item.id)}><span>{item.kind === "summary" ? "≡" : "?"}</span><div><strong>{item.kind === "summary" ? "Summary" : "Practice quiz"}</strong><small>{item.createdAt ? humanDate(item.createdAt) : "Saved"}{item.sourceMd5 !== file.md5Checksum ? " · Earlier PDF version" : ""}</small></div><b>→</b></button>)}</div> : <p className="quiet">Your summaries and quizzes will appear here.</p>}</>}
    </div></aside></>}
  </div>;
}
