"use client";

import { FileText, Library, ShieldCheck, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { IndexingToast, type UploadIndexingToast } from "../../../components/upload/IndexingToast";
import { UploadModal } from "../../../components/upload/UploadModal";
import { fetchAccessibleDocuments, fetchMyRole } from "../../../lib/documents";
import type { KnowledgeSource } from "../../../lib/ui-state";

export default function LibraryPage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadToasts, setUploadToasts] = useState<UploadIndexingToast[]>([]);

  const knowledgeBaseSources = useMemo(() => sources.filter((source) => source.sourceType === "knowledge-base"), [sources]);
  const personalSources = useMemo(() => sources.filter((source) => source.sourceType === "uploaded"), [sources]);
  const completedDocumentIds = useMemo(() => new Set(sources.filter((source) => source.status === "indexed").map((source) => source.id)), [sources]);
  const failedDocuments = useMemo(() => new Map(sources.filter((source) => source.status === "failed").map((source) => [source.id, source.summary ?? "Indexing failed"])), [sources]);

  const refreshSources = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    try {
      const nextSources = await fetchAccessibleDocuments({ force });
      setSources(nextSources);
      setStatus(nextSources.length ? "ready" : "empty");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshSources();
    fetchMyRole()
      .then((role) => setIsAdmin(role === "admin"))
      .catch(() => setIsAdmin(false));
  }, [refreshSources]);

  useEffect(() => {
    if (!sources.some((source) => source.status === "indexing")) return;
    const interval = window.setInterval(() => void refreshSources(), 3000);
    return () => window.clearInterval(interval);
  }, [refreshSources, sources]);

  return (
    <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-4 py-6 text-slate-100 md:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-4xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200">
                <Library className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">Knowledge Library</p>
                <h1 className="mt-1 text-2xl font-semibold text-white md:text-3xl">Real indexed sources</h1>
              </div>
            </div>

            {isAdmin ? (
              <button
                type="button"
                onClick={() => setIsUploadOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
              >
                <UploadCloud className="h-4 w-4" />
                Upload to knowledge base
              </button>
            ) : null}
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">Shared knowledge-base files are available to every user. Personal uploads remain private to your account.</p>
        </header>

        {isAdmin ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-cyan-300/15 bg-cyan-300/8 px-4 py-3 text-sm text-cyan-50">
            <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-200" />
            Admin role active. Knowledge-base uploads are shared with all users after indexing.
          </div>
        ) : null}

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <SourceSection title="Knowledge Base" items={knowledgeBaseSources} emptyMessage={status === "loading" ? "Loading knowledge-base documents..." : "No shared knowledge-base documents have been uploaded yet."} />
          <SourceSection title="Your Uploads" items={personalSources} emptyMessage={status === "loading" ? "Loading your uploads..." : "No personal uploads yet."} />
        </section>

        {status === "error" ? <p className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">Could not load the document library.</p> : null}
      </div>

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        uploadTarget="knowledge_base"
        onUploadToast={(toast) => {
          if (toast.documentId) void refreshSources({ force: true });
          setUploadToasts((current) => {
            const existing = current.find((item) => item.toastId === toast.toastId);
            return [
              ...current.filter((item) => item.toastId !== toast.toastId),
              {
                toastId: toast.toastId,
                documentId: toast.documentId ?? existing?.documentId,
                filename: toast.filename,
                queuedAt: toast.queuedAt ?? existing?.queuedAt ?? Date.now(),
                status: toast.status,
                errorMessage: toast.errorMessage,
              },
            ];
          });
        }}
        completedDocumentIds={completedDocumentIds}
        failedDocuments={failedDocuments}
      />
      <IndexingToast toasts={uploadToasts} onDismiss={(toastId) => setUploadToasts((current) => current.filter((toast) => toast.toastId !== toastId))} />
    </div>
  );
}

type SourceSectionProps = {
  title: string;
  items: KnowledgeSource[];
  emptyMessage: string;
};

function SourceSection({ title, items, emptyMessage }: SourceSectionProps) {
  return (
    <section className="rounded-4xl border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-slate-950/30 backdrop-blur-xl">
      <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => {
            const isFailed = item.status === "failed";
            // Indexed (and its aliases) render as a plain card; only failed and
            // in-progress documents carry a visual signal.
            const isInProgress = item.status !== "indexed" && !isFailed;
            const cardClass = isFailed
              ? "rounded-3xl border border-red-400/60 bg-red-400/5 p-4"
              : isInProgress
                ? "status-ring status-ring-indexing rounded-3xl bg-slate-950/95 p-4"
                : "rounded-3xl border border-white/10 bg-white/5 p-4";

            const body = (
              <div className="p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <FileText className={`mt-1 h-5 w-5 shrink-0 ${isFailed ? "text-red-300" : "text-cyan-200"}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-semibold ${isFailed ? "text-red-200" : "text-slate-100"}`} title={item.filename}>{item.filename}</p>
                    {item.createdAt ? <p className="mt-2 text-xs text-slate-500">Uploaded {new Date(item.createdAt).toLocaleDateString()}</p> : null}
                    {item.summary ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{item.summary}</p> : null}
                  </div>
                </div>
              </div>
            );

            return (
              <article key={item.id} className={cardClass}>
                {isInProgress ? <div className="relative">{body}</div> : body}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-500">{emptyMessage}</p>
      )}
    </section>
  );
}
