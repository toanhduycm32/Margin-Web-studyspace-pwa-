"use client";

import { vietnameseMessage } from "@/lib/shared/messages";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { api, ApiError } from "@/lib/client/api";
import { extractTextPages, partitionSectionPages } from "@/lib/client/extract";
import { documentSections, sectionLearningText } from "@/lib/client/structure";
import { correctOptionIds, responseType } from "@/lib/shared/quiz";
import { newOptionOrders } from "@/lib/shared/attempt-order";
import { sectionWordTarget, STUDY_RULE_VERSION } from "@/lib/shared/study-rules";
import { objectiveBlueprint } from "@/lib/shared/education";
import type { ArtifactRecord, AttemptRecord, ChunkResult, DocumentRecord, DriveFile, QuizQuestion, SignedMap } from "@/lib/shared/types";
import PageSurface from "./page-surface";
import SummaryContent from "./summary-content";

type ArtifactItem = { id: string; kind: string; sourceMd5: string; createdAt: string };
type Running = { stage: string; done: number; total: number; committing?: boolean };

function humanDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(value));
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



  const [running, setRunning] = useState<Running | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const resourceRequestRef = useRef(0);
  const submittingRef = useRef(false);
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
        if (document.changed) setNotice("PDF đã thay đổi trong Drive. Học liệu cũ thuộc phiên bản trước của tài liệu.");
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
    const requestId = ++resourceRequestRef.current;
    setError("");
    try {
      const result = await api<{ artifact: ArtifactRecord }>(`/api/artifacts/${artifactId}`);
      if (requestId !== resourceRequestRef.current) return;
      activeIdRef.current = result.artifact.id;
      setPreviousAttempt(null);
      setActive(result.artifact); setSubmitted(null); setAnswers([]); setQuizPage(0); setSheetOpen(true);
      setOptionOrders(result.artifact.kind === "quiz" ? newOptionOrders((result.artifact.payload as { questions: QuizQuestion[] }).questions) : []);
      if (result.artifact.kind === "quiz") {
        const attempts = await api<{ attempts: AttemptRecord[] }>(`/api/artifacts/${artifactId}/attempts`);
        if (requestId !== resourceRequestRef.current || activeIdRef.current !== artifactId) return;
        setPreviousAttempt(attempts.attempts[0] || null);
      } else setPreviousAttempt(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not open saved resource."); }
  }

  async function run(kind: "summary" | "quiz") {
    if (!pdf || !file?.md5Checksum || abortRef.current) return;
    const controller = new AbortController(); abortRef.current = controller;
    let requestedCount = 0;
    const profile = kind === "summary" ? "medical" as const : undefined;
    let operationKey = "";
    setError(""); setNotice(""); setSheetOpen(true);
    setRunning({ stage: "Đang chuẩn bị tài liệu", done: 0, total: 1 });
    try {
      const [config, account] = await Promise.all([api<{ missing: string[] }>("/api/config"), api<{ email: string }>("/api/auth/me")]);
      if (config.missing.includes("NVIDIA_API_KEY")) throw new Error("Add NVIDIA_API_KEY to .env.local before using AI.");
      setRunning({ stage: "Đang đọc toàn bộ tài liệu", done: 0, total: pdf.numPages });
      const pages = await extractTextPages(pdf, (done, total) => setRunning({ stage: "Đang đọc toàn bộ tài liệu", done, total }), controller.signal);
      const sections = await documentSections(pdf, pages);
      const learningPages = sectionLearningText(pages, sections);
      const chunks = partitionSectionPages(learningPages, sections).map((chunk) => ({ ...chunk,
        emptyPages: pages.filter((page) => page.page >= chunk.startPage && page.page <= chunk.endPage && !page.text.trim()).map((page) => page.page),
        excluded: learningPages.filter((page) => page.page >= chunk.startPage && page.page <= chunk.endPage).every((page) => !page.text.trim()),
      }));
      const evidenceMode = "research";
      operationKey = `margin-ai-${account.email}-${STUDY_RULE_VERSION}-${id}-${file.md5Checksum}-${kind}`;
      const operationId = sessionStorage.getItem(operationKey) || crypto.randomUUID();
      sessionStorage.setItem(operationKey, operationId);
      await api("/api/ai/begin", { method: "POST", signal: controller.signal,
        body: JSON.stringify({ id: operationId, documentId: id, sourceMd5: file.md5Checksum, kind }) });
      const sectionSizes = new Map(sections.map((section) => [section.id,
        chunks.filter((chunk) => chunk.section?.id === section.id).reduce((sum, chunk) => sum + chunk.text.length, 0)]));
      const plans: SignedMap[] = [];
      if (kind === "quiz") {
        for (let index = 0; index < chunks.length; index++) {
          setRunning({ stage: "Lập ma trận kiến thức cho toàn tài liệu", done: index, total: chunks.length });
          const chunk = chunks[index];
          plans.push(await api<SignedMap>("/api/ai/plan", { method: "POST", signal: controller.signal,
            body: JSON.stringify({ ...chunk, kind, operationId, documentId: id, sourceMd5: file.md5Checksum,
              chunkIndex: index, chunkCount: chunks.length, pageCount: pdf.numPages }) }));
        }
      }
      const blueprint = objectiveBlueprint(plans.map(({ map }) => ({ objectives: map.objectives || [], limitations: map.planningLimitations || [] })));
      requestedCount = blueprint.reduce((total, part) => total + part.formats.length, 0);
      if (kind === "quiz" && !requestedCount) throw new Error("Chưa tìm thấy đủ nội dung có chứng cứ để tạo trắc nghiệm.");
      if (requestedCount > 800) throw new Error("Ma trận vượt sức chứa của một lượt xử lý. Chưa lưu bộ câu hỏi thiếu nội dung; bản cũ vẫn được giữ.");
      const signed: SignedMap[] = [];
      for (let index = 0; index < chunks.length; index++) {
        if (controller.signal.aborted) throw new Error("Đã dừng xử lý. Thử lại để tiếp tục từ phần đã lưu.");
        setRunning({ stage: kind === "summary" ? "Đang viết tóm tắt theo từng bài" : `Tạo ${requestedCount} câu hỏi theo ma trận`, done: index, total: chunks.length });
        const chunk = chunks[index];
        const sectionSize = sectionSizes.get(chunk.section!.id) || chunk.text.length;
        const wordTarget = profile ? Math.min(1800, Math.max(20, Math.round(sectionWordTarget(profile, sectionSize) * chunk.text.length / sectionSize))) : undefined;
        const body = JSON.stringify({ kind, operationId, documentId: id, sourceMd5: file.md5Checksum,
          chunkIndex: index, chunkCount: chunks.length, startPage: chunk.startPage, endPage: chunk.endPage,
          pageCount: pdf.numPages, requestedCount, emptyPages: chunk.emptyPages, text: chunk.text,
          section: chunk.section, excluded: chunk.excluded, summaryProfile: profile, wordTarget, evidenceMode,
          objectives: kind === "quiz" ? blueprint[index].objectives : undefined, learningPlan: plans[index],
          plannedFormats: kind === "quiz" ? blueprint[index].formats : undefined,
          plannedFamilies: kind === "quiz" ? blueprint[index].families : undefined });
        let result: SignedMap | null = null;
        const maxSteps = kind === "quiz" ? blueprint[index].formats.length * 10 + 8 : 80;
        for (let step = 0; !result && step < maxSteps; step++) {
          for (let retry = 0; retry < 4; retry++) {
            try {
              const response = await api<ChunkResult>("/api/ai/chunk", { method: "POST", signal: controller.signal, body });
              if ("pending" in response) {
                setRunning({ stage: response.stage || `Đã lưu ${response.completedQuestions}/${response.totalQuestions} câu của phần này`,
                  done: index, total: chunks.length });
              } else result = response;
              break;
            }
            catch (caught) {
              if (!(caught instanceof ApiError) || caught.status !== 503 || retry === 3 || controller.signal.aborted) throw caught;
              await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(resolve, 800 * 2 ** retry);
                controller.signal.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("Đã dừng xử lý.")); }, { once: true });
              });
            }
          }
        }
        if (!result) throw new Error("Phần này chưa hoàn tất. Thử lại để tiếp tục các bước đã lưu.");
        signed.push(result);
      }
      setRunning({ stage: kind === "summary" ? "Đang lưu tóm tắt" : "Đang lưu trắc nghiệm", done: chunks.length, total: chunks.length, committing: true });
      const result = await api<{ artifact: ArtifactRecord }>("/api/ai/finalize", { method: "POST",
        body: JSON.stringify({ kind, operationId, documentId: id, sourceMd5: file.md5Checksum, requestedCount,
          summaryProfile: profile, evidenceMode, maps: signed }),
      });
      sessionStorage.removeItem(operationKey);
      resourceRequestRef.current++;
      activeIdRef.current = result.artifact.id;
      setActive(result.artifact); setAnswers([]); setSubmitted(null); setPreviousAttempt(null); setQuizPage(0);
      setOptionOrders(result.artifact.kind === "quiz" ? newOptionOrders((result.artifact.payload as { questions: QuizQuestion[] }).questions) : []);
      let refreshed = true;
      try { await refreshArtifacts(); } catch { refreshed = false; }
      setNotice(refreshed ? `${kind === "summary" ? "Tóm tắt" : "Trắc nghiệm"} đã lưu vào Google Drive.` :
        "Đã lưu học liệu vào Drive. Mở lại PDF để cập nhật danh sách.");
    } catch (caught) {
      if (operationKey && caught instanceof ApiError && ["RESTART_GENERATION", "GENERATION_SUPERSEDED"].includes(caught.code || "")) {
        sessionStorage.removeItem(operationKey);
      }
      setError(controller.signal.aborted ? "Đã dừng. Bản hiện hành vẫn được giữ; bạn có thể tiếp tục phần đang tạo." :
      caught instanceof Error ? caught.message : "Whole-PDF processing failed."); }
    finally { abortRef.current = null; setRunning(null); }
  }

  async function submitQuiz() {
    if (!active || active.kind !== "quiz" || submittingRef.current) return;
    const questions = (active.payload as { questions: QuizQuestion[] }).questions;
    const missing = questions.findIndex((question, index) => !answers[index]?.length ||
      responseType(question) === "select_n" && answers[index].length !== (question as { selectionCount: number }).selectionCount);
    if (missing >= 0) { setQuizPage(Math.floor(missing / 10)); setError(`Trả lời câu ${missing + 1} trước khi nộp bài.`); return; }
    setError("");
    submittingRef.current = true;
    try {
      const result = await api<{ attempt: AttemptRecord }>(`/api/artifacts/${active.id}/attempts`, {
        method: "POST", body: JSON.stringify({ answers }),
      });
      if (activeIdRef.current === result.attempt.artifactId) { setSubmitted(result.attempt); setPreviousAttempt(result.attempt); }
    } catch (caught) { if (activeIdRef.current === active.id) setError(caught instanceof Error ? caught.message : "Could not save quiz attempt."); }
    finally { submittingRef.current = false; }
  }

  if (!record || !file) return <main className="reader-loading"><button className="text-link" onClick={() => router.push("/")}>← Thư viện</button><h1>{error ? vietnameseMessage(error) : "Đang mở PDF…"}</h1></main>;
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

  return <div className="reader-shell"><header className="reader-top"><button className="reader-back" onClick={() => router.push("/")} aria-label="Về thư viện">← <span>Thư viện</span></button><div className="reader-name" title={file.name}>{file.name}</div><div className="reader-top-actions"><span className="current-page">{currentPage}{pdf ? ` / ${pdf.numPages}` : ""}</span><button className="reader-study" onClick={() => setSheetOpen(true)}>✦ <span>Học tập</span></button></div></header>
    {notice && <div className="reader-alert notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Đóng thông báo">×</button></div>}
    {error && !sheetOpen && <div className="reader-alert error" role="alert">{vietnameseMessage(error)}<button onClick={() => setError("")} aria-label="Đóng thông báo lỗi">×</button></div>}
    {!pdf ? <div className="reader-loading-inline">{error ? <button className="button secondary" onClick={() => window.location.reload()}>Thử mở lại PDF</button> : "Đang mở bản PDF gốc…"}</div> : <main className="pdf-flow" ref={contentRef}>{Array.from({ length: pdf.numPages }, (_, index) => <PageSurface key={index + 1} pdf={pdf} number={index + 1} width={width} active={near.has(index + 1)} />)}</main>}
    {sheetOpen && <><button className="sheet-backdrop" aria-label="Đóng bảng học tập" onClick={() => setSheetOpen(false)} /><aside className="study-sheet" aria-label="Học liệu của tài liệu"><div className="sheet-header"><div><span className="eyebrow">TÀI LIỆU NÀY</span><h2>{active ? active.kind === "summary" ? "Tóm tắt" : "Trắc nghiệm" : "Học cùng tài liệu"}</h2></div><button className="sheet-close" aria-label="Đóng bảng học tập" onClick={() => setSheetOpen(false)}>×</button></div><div className="sheet-body">
      {error && <div className="alert error" role="alert">{vietnameseMessage(error)}<button onClick={() => setError("")} aria-label="Đóng thông báo lỗi">×</button></div>}
      {running && <div className="processing"><div className="processing-symbol">✦</div><h3>{running.stage}</h3><p>{running.stage === "Đang đọc toàn bộ tài liệu" ? `${running.done}/${running.total} trang` : `${Math.round(running.done / Math.max(1, running.total) * 100)}% hoàn tất`}</p><div className="progress-track"><div style={{ width: `${Math.round(running.done / Math.max(1, running.total) * 100)}%` }} /></div><p className="quiet">Bạn có thể đóng bảng này để tiếp tục đọc. Các phần hoàn tất đã được lưu; bản hiện hành vẫn còn nguyên.</p><button className="text-link" disabled={running.committing} onClick={() => abortRef.current?.abort()}>{running.committing ? "Đang xác nhận lưu vào Drive…" : "Dừng xử lý"}</button></div>}{active ? <>
        <button className="text-link back-to-tools" onClick={() => { resourceRequestRef.current++; activeIdRef.current = null; setActive(null); setAnswers([]); setSubmitted(null); }}>← Học liệu của tài liệu</button>
        <p className="resource-meta">Đã tạo {humanDate(active.createdAt)} · {active.readablePages}/{active.pageCount} trang trích xuất được văn bản{active.sourceMd5 !== file.md5Checksum ? " · Phiên bản PDF trước" : ""}</p>
        {active.evidenceMode === "research" && <div className="coverage-warning">Đối chiếu nguồn ngoài khi có nội dung phù hợp. {active.evidenceReferences?.length
          ? <>Các nguồn dưới đây được tham khảo để đối chiếu; điều này không xác minh mọi nhận định: {active.evidenceReferences.map((reference, index) =>
            <span key={reference.url}>{index ? "; " : ""}<a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.title} ({reference.year})</a>{reference.kind === "curated_guideline_note" ? ` — ghi chú đối chiếu ${reference.reviewedAt || "đã tuyển chọn"}` : reference.kind === "research_abstract" ? " — tóm lược nghiên cứu" : ""}</span>)}</>
          : "Chưa lấy được nguồn ngoài phù hợp. Học liệu này chỉ dựa trên PDF."}</div>}
        {active.emptyPages.length > 0 && <p className="coverage-warning">Không trích xuất được chữ ở {active.emptyPages.length} trang. Hình ảnh, sơ đồ và bản quét chưa được diễn giải.</p>}
        {active.kind === "quiz" && active.sections && active.assessedSectionIds && active.assessedSectionIds.length < active.sections.filter((section) => section.role !== "front_matter").length &&
          <p className="coverage-warning">Bộ câu hỏi đánh giá {active.assessedSectionIds.length}/{active.sections.filter((section) => section.role !== "front_matter").length} phần học tập đã nhận diện. Chưa đánh giá đủ các phần còn lại.</p>}
        {!!active.planningLimitations?.length && <div className="coverage-warning"><strong>Giới hạn ma trận học tập</strong><ul>{[...new Set(active.planningLimitations)].map((item, index) => <li key={index}>{item}</li>)}</ul></div>}{active.kind === "summary" ? <SummaryContent text={(active.payload as { text: string }).text} /> : <div className="quiz-body">{previousAttempt && !submitted && <p className="previous-attempt">Lần làm trước: {previousAttempt.score}/{previousAttempt.questionCount} · {humanDate(previousAttempt.createdAt)}</p>}
          {submitted && <div className="quiz-score"><strong>{submitted.score}/{submitted.questionCount}</strong><span>câu trả lời đúng</span></div>}
          <p className="resource-meta">Đã trả lời {answeredCount}/{questions.length} câu</p>
          {questions.slice(quizPage * 10, quizPage * 10 + 10).map((question, offset) => {
            const index = quizPage * 10 + offset;
            const selected = answers[index] || [];
            const correct = correctOptionIds(question);
            const format = responseType(question);
            const isCorrect = selected.length === correct.length && selected.every((id) => correct.includes(id));
            const displayOrder = optionOrders[index] || question.options.map((_, optionIndex) => optionIndex);
            return <section className="quiz-question" key={"id" in question ? question.id : index}>
              <div className="question-kicker">CÂU {index + 1}/{questions.length} · TRANG {question.startPage}–{question.endPage}</div>
              <h3>{question.question}</h3>
              <p className="question-instruction">{format === "single_best" ? "Chọn một đáp án đúng nhất." : format === "select_n"
                ? `Chọn đúng ${"selectionCount" in question ? question.selectionCount : correct.length} đáp án.`
                : "Chọn tất cả đáp án đúng."}</p>
              <div className="quiz-options">{displayOrder.map((optionIndex, displayIndex) => <label key={optionIndex}
                className={`quiz-option ${selected.includes(optionIndex) ? "chosen" : ""} ${submitted && correct.includes(optionIndex) ? "correct" : ""} ${submitted && selected.includes(optionIndex) && !correct.includes(optionIndex) ? "incorrect" : ""}`}>
                <input type={format === "single_best" ? "radio" : "checkbox"} name={`question-${index}`}
                  checked={selected.includes(optionIndex)} disabled={!!submitted}
                  onChange={() => chooseAnswer(question, index, optionIndex)} />
                <span className="option-letter">{String.fromCharCode(65 + displayIndex)}</span>
                <span>{question.options[optionIndex]}{submitted && "optionExplanations" in question && <small className="option-feedback"><strong>{correct.includes(optionIndex) ? selected.includes(optionIndex) ? "Đã chọn đúng. " : "Bỏ sót đáp án đúng. " : selected.includes(optionIndex) ? "Đã chọn đáp án sai. " : "Đã loại đúng. "}</strong>{question.optionExplanations[optionIndex]}</small>}</span>
              </label>)}</div>
              {submitted && <div className="answer-explanation"><strong>{isCorrect ? "Chính xác" :
                `Đáp án đúng: ${correct.map((id) => String.fromCharCode(65 + displayOrder.indexOf(id))).join(", ")}`}</strong>
                <p>{question.explanation}</p><small>Trích nguồn: “{question.sourceExcerpt}”</small></div>}
            </section>;
          })}
          {quizPageCount > 1 && <div className="quiz-pagination"><button className="button secondary" onClick={() => setQuizPage((page) => Math.max(0, page - 1))} disabled={quizPage === 0}>← Trước</button><span>{quizPage + 1} / {quizPageCount}</span><button className="button secondary" onClick={() => setQuizPage((page) => Math.min(quizPageCount - 1, page + 1))} disabled={quizPage >= quizPageCount - 1}>Tiếp →</button></div>}
          {!submitted ? quizPage === quizPageCount - 1 && <button className="button primary full" onClick={() => void submitQuiz()}>Nộp bài</button> : <button className="button secondary full" onClick={() => { setAnswers([]); setSubmitted(null); setQuizPage(0); setOptionOrders(newOptionOrders(questions, optionOrders)); }}>Làm lại</button>}
        </div>}
      </> : <><p className="sheet-intro">Học từ toàn bộ tài liệu. Nội dung, độ dài và số câu hỏi được phân bổ theo kiến thức trong PDF.</p><div className="study-actions">{(["summary", "quiz"] as const).map((kind) => {
          const saved = artifacts.find((item) => item.kind === kind);
          return <div className="resource-action" key={kind}><button className="study-action" disabled={!pdf || !!running && !saved}
            onClick={() => saved ? void openArtifact(saved.id) : void run(kind)}><span className="action-glyph">{kind === "summary" ? "≡" : "?"}</span><span><strong>{kind === "summary" ? saved ? "Xem tóm tắt" : "Tóm tắt tài liệu" : saved ? "Làm trắc nghiệm" : "Tạo trắc nghiệm"}</strong><small>{saved ? `${humanDate(saved.createdAt)}${saved.sourceMd5 !== file.md5Checksum ? " · Phiên bản PDF trước" : ""}` : kind === "summary" ? "Giải thích theo từng bài và đề mục" : "Lý thuyết và vận dụng có chứng cứ"}</small></span><b>→</b></button>{saved && <button className="text-link regenerate" disabled={!!running || !pdf} onClick={() => void run(kind)}>{kind === "summary" ? "Tạo lại tóm tắt" : "Tạo lại trắc nghiệm"}</button>}</div>;
        })}</div><p className="privacy-note">Bản hiện hành được giữ đến khi bản mới tạo và lưu thành công. Khi tạo học liệu, văn bản PDF được gửi đến NVIDIA. Không sử dụng hồ sơ có thông tin nhận diện người bệnh. Tài liệu scan và hình ảnh có thể chưa đọc được.</p></>}
    </div></aside></>}
  </div>;
}
