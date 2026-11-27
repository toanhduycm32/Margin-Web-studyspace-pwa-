"use client";

import { vietnameseMessage } from "@/lib/shared/messages";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client/api";
import { openPdfPicker } from "@/lib/client/picker";
import type { LibraryItem } from "@/lib/shared/types";

type AuthState = "loading" | "setup" | "signed-out" | "signed-in";

export default function Home() {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>("loading");
  const [email, setEmail] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [documents, setDocuments] = useState<LibraryItem[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const config = await api<{ missing: string[] }>("/api/config");
        if (cancelled) return;
        setMissing(config.missing);
        const required = config.missing.filter((name) => ![
          "NVIDIA_API_KEY", "NEXT_PUBLIC_GOOGLE_PICKER_API_KEY", "NEXT_PUBLIC_GOOGLE_APP_ID",
        ].includes(name));
        if (required.length) { setAuth("setup"); return; }
        const me = await api<{ email: string }>("/api/auth/me");
        if (cancelled) return;
        setEmail(me.email); setAuth("signed-in");
        const library = await api<{ documents: LibraryItem[]; nextPageToken: string | null }>("/api/library");
        if (!cancelled) { setDocuments(library.documents); setNextPageToken(library.nextPageToken); }
      } catch (caught) {
        if (!cancelled) {
          if (caught instanceof ApiError && caught.status === 401) setAuth("signed-out");
          else { setAuth((current) => current === "signed-in" ? current : "signed-out"); setError(caught instanceof Error ? caught.message : "Could not open the library."); }
        }
      }
    }
    void load();
    const outcome = new URLSearchParams(window.location.search).get("auth");
    if (outcome) {
      setNotice(outcome === "connected" ? "Đã kết nối Google Drive của bạn." : outcome === "not-authorized" ?
        "Tài khoản này chưa được cấp quyền dùng Margin. Hãy liên hệ người quản lý ứng dụng." :
        "Chưa kết nối được Google. Kiểm tra tài khoản và thử lại.");
      window.history.replaceState({}, "", window.location.pathname);
    }
    return () => { cancelled = true; };
  }, []);

  async function connect() {
    setBusy("connect"); setError("");
    try {
      const result = await api<{ url: string }>("/api/auth/start", { method: "POST" });
      window.location.assign(result.url);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not connect Google."); setBusy(""); }
  }

  async function disconnect() {
    if (!window.confirm("Ngắt kết nối tài khoản này khỏi Margin? PDF và học liệu vẫn được giữ trong Drive.")) return;
    setBusy("disconnect"); setError("");
    try {
      await api("/api/auth/disconnect", { method: "POST" });
      setAuth("signed-out"); setDocuments([]); setEmail(""); setNotice("Đã ngắt kết nối tài khoản Google.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not disconnect Google."); }
    finally { setBusy(""); }
  }

  async function loadMore() {
    if (!nextPageToken) return;
    setBusy("more"); setError("");
    try {
      const result = await api<{ documents: LibraryItem[]; nextPageToken: string | null }>(`/api/library?pageToken=${encodeURIComponent(nextPageToken)}`);
      setDocuments((current) => [...current, ...result.documents.filter((item) => !current.some((old) => old.sourceId === item.sourceId))]);
      setNextPageToken(result.nextPageToken);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load more PDFs."); }
    finally { setBusy(""); }
  }

  async function pickPdf() {
    setBusy("picker"); setError("");
    try {
      const { accessToken } = await api<{ accessToken: string }>("/api/google/picker-token");
      await openPdfPicker(accessToken, (ids) => { void importPicked(ids); });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not open Google Picker."); }
    finally { setBusy(""); }
  }

  async function importPicked(ids: string[]) {
    setBusy("import"); setError("");
    try {
      let first: string | null = null;
      for (const fileId of ids) {
        const result = await api<{ item: LibraryItem }>("/api/library", {
          method: "POST", body: JSON.stringify({ fileId }),
        });
        first ??= result.item.sourceId;
      }
      const library = await api<{ documents: LibraryItem[]; nextPageToken: string | null }>("/api/library");
      setDocuments(library.documents); setNextPageToken(library.nextPageToken);
      setNotice(`Đã thêm ${ids.length} PDF vào thư viện.`);
      if (first) router.push(`/read/${encodeURIComponent(first)}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not add PDF."); }
    finally { setBusy(""); }
  }

  if (auth === "loading") return <main className="center-screen"><div className="mark small">M</div><p>Đang mở Margin…</p></main>;
  if (auth === "setup") return <main className="center-screen setup-screen"><div className="mark">M</div><h1>Ứng dụng chưa sẵn sàng.</h1><p>Kết nối Google và dịch vụ học tập chưa được thiết lập đầy đủ.</p><p className="quiet">Vui lòng liên hệ người quản lý để hoàn tất kết nối.</p></main>;
  if (auth === "signed-out") return <main className="welcome"><div className="welcome-inner"><div className="wordmark"><span className="mark small">M</span>Margin</div><div className="welcome-copy"><span className="eyebrow">KHÔNG GIAN HỌC TẬP</span><h1>Hiểu sâu kiến thức.<br/>Vững vàng mỗi bài học.</h1><p>Đọc giáo trình, hiểu các cơ chế và luyện trắc nghiệm bằng tiếng Việt. Tài liệu và học liệu nằm trong Google Drive riêng của bạn.</p><button className="button primary" onClick={() => void connect()} disabled={!!busy}>{busy === "connect" ? "Đang kết nối…" : "Tiếp tục với Google"}</button>{notice && <p className="inline-notice">{notice}</p>}{error && <p className="inline-error" role="alert">{vietnameseMessage(error)}</p>}</div><div className="welcome-foot">Một nơi tập trung cho việc học.</div></div></main>;

  const filtered = documents.filter((item) => item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const pickerMissing = missing.includes("NEXT_PUBLIC_GOOGLE_PICKER_API_KEY") || missing.includes("NEXT_PUBLIC_GOOGLE_APP_ID");
  return <div className="library-shell"><header className="library-header"><div className="wordmark"><span className="mark small">M</span>Margin</div><button className="account-button" onClick={() => void disconnect()} disabled={!!busy} title={`Drive riêng của ${email}`}>{email}<span>Ngắt kết nối</span></button></header><main className="library-main">
    {error && <div className="alert error" role="alert">{vietnameseMessage(error)}<button onClick={() => setError("")} aria-label="Đóng thông báo lỗi">×</button></div>}
    {notice && <div className="alert notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Đóng thông báo">×</button></div>}
    <div className="library-heading"><div><span className="eyebrow">THƯ VIỆN</span><h1>Tài liệu của bạn</h1><p>Mở tài liệu và tiếp tục từ nơi bạn đã đọc.</p></div><button className="button primary add-pdf" onClick={() => void pickPdf()} disabled={!!busy || pickerMissing}>{busy === "picker" ? "Đang mở…" : busy === "import" ? "Đang thêm…" : "＋ Thêm PDF"}</button></div>
    {pickerMissing && <div className="quiet-banner">Trình chọn Google Drive chưa sẵn sàng. Vui lòng liên hệ người quản lý để hoàn tất kết nối.</div>}
    {!missing.includes("NVIDIA_API_KEY") ? null : <div className="quiet-banner">Bạn có thể đọc PDF. Dịch vụ tóm tắt và trắc nghiệm đang chờ thiết lập.</div>}
    <label className="search"><span>Tìm trong thư viện</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tài liệu PDF" /></label>
    {documents.length ? <>{filtered.length ? <div className="document-list">{filtered.map((item) => <button key={item.sourceId} className="document-row" onClick={() => router.push(`/read/${encodeURIComponent(item.sourceId)}`)}><span className="pdf-symbol">PDF</span><span className="document-row-text"><strong>{item.name}</strong><small>Đã lưu trong Google Drive của bạn</small></span><span className="arrow">↗</span></button>)}</div> : <div className="empty-list">Không tìm thấy tài liệu phù hợp.</div>}{nextPageToken && <button className="button secondary load-more" onClick={() => void loadMore()} disabled={!!busy}>{busy === "more" ? "Đang tải…" : "Xem thêm"}</button>}</> : <div className="empty-library"><div className="empty-icon">▤</div><h2>Bắt đầu với một tài liệu.</h2><p>Chọn PDF có sẵn trong Drive hoặc tải tài liệu lên.</p><button className="button secondary" onClick={() => void pickPdf()} disabled={!!busy || pickerMissing}>Chọn tài liệu PDF</button></div>}
  </main></div>;
}
