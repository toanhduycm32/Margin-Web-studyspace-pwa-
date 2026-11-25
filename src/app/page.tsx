"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
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
          if (caught instanceof Error && /Connect your Google account|Session is invalid|permission expired/i.test(caught.message)) setAuth("signed-out");
          else { setAuth((current) => current === "signed-in" ? current : "signed-out"); setError(caught instanceof Error ? caught.message : "Could not open the library."); }
        }
      }
    }
    void load();
    const outcome = new URLSearchParams(window.location.search).get("auth");
    if (outcome) {
      setNotice(outcome === "connected" ? "Google Drive connected." : "Google connection did not complete. Check the account and try again.");
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
    if (!window.confirm("Disconnect this Google account from Margin? Your PDFs and saved resources remain in Drive.")) return;
    setBusy("disconnect"); setError("");
    try {
      await api("/api/auth/disconnect", { method: "POST" });
      setAuth("signed-out"); setDocuments([]); setEmail(""); setNotice("Google account disconnected.");
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
      setNotice(`${ids.length} PDF${ids.length === 1 ? "" : "s"} added to your library.`);
      if (first) router.push(`/read/${encodeURIComponent(first)}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not add PDF."); }
    finally { setBusy(""); }
  }

  if (auth === "loading") return <main className="center-screen"><div className="mark small">M</div><p>Opening Margin…</p></main>;
  if (auth === "setup") return <main className="center-screen setup-screen"><div className="mark">M</div><h1>Finish the connection.</h1><p>Add the following values to <code>.env.local</code>, then restart the app.</p><ul>{missing.map((name) => <li key={name}>{name}</li>)}</ul><p className="quiet">The setup guide is in README.md. Keep secret values out of chat and source control.</p></main>;
  if (auth === "signed-out") return <main className="welcome"><div className="welcome-inner"><div className="wordmark"><span className="mark small">M</span>Margin</div><div className="welcome-copy"><span className="eyebrow">YOUR READING SPACE</span><h1>Read deeply.<br/>Remember more.</h1><p>Your PDFs stay in Google Drive. Read them here and turn the whole document into summaries and practice questions.</p><button className="button primary" onClick={() => void connect()} disabled={!!busy}>{busy === "connect" ? "Connecting…" : "Continue with Google"}</button>{notice && <p className="inline-notice">{notice}</p>}{error && <p className="inline-error" role="alert">{error}</p>}</div><div className="welcome-foot">A quieter way to study.</div></div></main>;

  const filtered = documents.filter((item) => item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const pickerMissing = missing.includes("NEXT_PUBLIC_GOOGLE_PICKER_API_KEY") || missing.includes("NEXT_PUBLIC_GOOGLE_APP_ID");
  return <div className="library-shell"><header className="library-header"><div className="wordmark"><span className="mark small">M</span>Margin</div><button className="account-button" onClick={() => void disconnect()} disabled={!!busy} title={email}>{email}<span>Disconnect</span></button></header><main className="library-main">
    {error && <div className="alert error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
    {notice && <div className="alert notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notice">×</button></div>}
    <div className="library-heading"><div><span className="eyebrow">LIBRARY</span><h1>Your PDFs</h1><p>Open a document and pick up where you left off.</p></div><button className="button primary add-pdf" onClick={() => void pickPdf()} disabled={!!busy || pickerMissing}>{busy === "picker" ? "Opening…" : busy === "import" ? "Adding…" : "＋ Add PDF"}</button></div>
    {pickerMissing && <div className="quiet-banner">To add PDFs, enable Google Picker API and set <code>NEXT_PUBLIC_GOOGLE_PICKER_API_KEY</code> in <code>.env.local</code>, then restart the app.</div>}
    {!missing.includes("NVIDIA_API_KEY") ? null : <div className="quiet-banner">Reading is ready. Add <code>NVIDIA_API_KEY</code> to <code>.env.local</code> to use summaries and quizzes.</div>}
    <label className="search"><span>Search library</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a PDF" /></label>
    {documents.length ? <>{filtered.length ? <div className="document-list">{filtered.map((item) => <button key={item.sourceId} className="document-row" onClick={() => router.push(`/read/${encodeURIComponent(item.sourceId)}`)}><span className="pdf-symbol">PDF</span><span className="document-row-text"><strong>{item.name}</strong><small>Stored in your Google Drive</small></span><span className="arrow">↗</span></button>)}</div> : <div className="empty-list">No PDFs match your search.</div>}{nextPageToken && <button className="button secondary load-more" onClick={() => void loadMore()} disabled={!!busy}>{busy === "more" ? "Loading…" : "Load more"}</button>}</> : <div className="empty-library"><div className="empty-icon">▤</div><h2>One good document is a start.</h2><p>Choose a PDF already in Drive or upload one through the Google picker.</p><button className="button secondary" onClick={() => void pickPdf()} disabled={!!busy || pickerMissing}>Choose a PDF</button></div>}
  </main></div>;
}
