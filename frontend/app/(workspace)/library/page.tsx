"use client";

import {
  CheckCircle2,
  Clock,
  FileText,
  Library,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { IndexingToast, type UploadIndexingToast } from "../../../components/upload/IndexingToast";
import { UploadModal } from "../../../components/upload/UploadModal";
import { useWorkspaceOptional } from "../../../components/workspace/WorkspaceShell";
import { deleteDocumentById, fetchAccessibleDocuments, fetchMyRole } from "../../../lib/documents";
import type { KnowledgeSource } from "../../../lib/ui-state";
import { StatusBadge } from "../../../components/ui/StatusBadge";

type StatusFilter = "all" | "indexed" | "indexing" | "failed";

export default function LibraryPage() {
  const workspace = useWorkspaceOptional();

  const [localSources, setLocalSources] = useState<KnowledgeSource[]>([]);
  const [localStatus, setLocalStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [localIsAdmin, setLocalIsAdmin] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<"personal" | "knowledge_base">("personal");
  const [uploadToasts, setUploadToasts] = useState<UploadIndexingToast[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const sources = workspace ? workspace.sources : localSources;
  const isAdmin = workspace ? workspace.isAdmin : localIsAdmin;
  const status: "loading" | "ready" | "empty" | "error" = workspace
    ? workspace.sourceStatus === "unavailable"
      ? "error"
      : workspace.sourceStatus
    : localStatus;

  const refreshSources = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (workspace) {
        await workspace.refreshSources({ force });
        return;
      }
      try {
        const nextSources = await fetchAccessibleDocuments({ force });
        setLocalSources(nextSources);
        setLocalStatus(nextSources.length ? "ready" : "empty");
      } catch {
        setLocalStatus("error");
      }
    },
    [workspace],
  );

  useEffect(() => {
    if (workspace) return;
    refreshSources().catch(() => {});
    fetchMyRole()
      .then((role) => setLocalIsAdmin(role === "admin"))
      .catch(() => setLocalIsAdmin(false));
  }, [refreshSources, workspace]);

  useEffect(() => {
    if (workspace) return;
    if (!sources.some((source) => source.status === "indexing")) return;
    const interval = window.setInterval(() => {
      refreshSources({ force: true }).catch(() => {});
    }, 3000);
    return () => window.clearInterval(interval);
  }, [refreshSources, sources, workspace]);

  const handleDelete = useCallback(
    async (sourceId: string) => {
      if (workspace) {
        await workspace.handleDeleteSource(sourceId);
        return;
      }
      let removed: KnowledgeSource | undefined;
      setLocalSources((current) => {
        removed = current.find((s) => s.id === sourceId);
        const next = current.filter((s) => s.id !== sourceId);
        setLocalStatus(next.length ? "ready" : "empty");
        return next;
      });
      try {
        await deleteDocumentById(sourceId);
      } catch {
        if (removed) {
          const item = removed;
          setLocalSources((current) => [item, ...current]);
          setLocalStatus("ready");
        }
      }
    },
    [workspace],
  );

  const handleOpenUpload = useCallback(
    (target: "personal" | "knowledge_base") => {
      if (workspace) {
        workspace.openUploadModal(target);
        return;
      }
      setUploadTarget(target);
      setIsUploadOpen(true);
    },
    [workspace],
  );

  const filteredSources = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sources.filter((source) => {
      if (statusFilter !== "all" && source.status !== statusFilter) return false;
      if (q && !source.filename.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [searchQuery, sources, statusFilter]);

  const knowledgeBaseSources = useMemo(
    () => filteredSources.filter((source) => source.sourceType === "knowledge-base"),
    [filteredSources],
  );
  const personalSources = useMemo(
    () => filteredSources.filter((source) => source.sourceType === "uploaded"),
    [filteredSources],
  );

  const stats = useMemo(() => {
    const total = sources.length;
    const indexed = sources.filter((s) => s.status === "indexed").length;
    const personal = sources.filter((s) => s.sourceType === "uploaded").length;
    const shared = sources.filter((s) => s.sourceType === "knowledge-base").length;
    return { total, indexed, personal, shared };
  }, [sources]);

  const completedDocumentIds = useMemo(
    () => new Set(sources.filter((source) => source.status === "indexed").map((source) => source.id)),
    [sources],
  );
  const failedDocuments = useMemo(
    () =>
      new Map(
        sources
          .filter((source) => source.status === "failed")
          .map((source) => [source.id, source.summary ?? "Indexing failed"]),
      ),
    [sources],
  );

  return (
    <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-4 py-6 text-slate-100 md:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-4xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3.5">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-300/20">
                <Library className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">Knowledge Library</p>
                <h1 className="mt-1 text-2xl font-semibold text-white md:text-3xl">Real indexed sources</h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleOpenUpload("personal")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
              >
                <Upload className="h-4 w-4" />
                Upload notes
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => handleOpenUpload("knowledge_base")}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-300/25 bg-violet-400/12 px-4 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200"
                >
                  <UploadCloud className="h-4 w-4" />
                  Upload to knowledge base
                </button>
              ) : null}
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
            Shared knowledge-base files are available to every user. Personal uploads remain private to your account.
          </p>

          {/* Quick Stats Row */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-slate-400">Total Sources</p>
              <p className="mt-1 text-xl font-semibold text-white">{stats.total}</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-emerald-300">Ready for RAG</p>
              <p className="mt-1 text-xl font-semibold text-white">{stats.indexed}</p>
            </div>
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-cyan-200">Your Uploads</p>
              <p className="mt-1 text-xl font-semibold text-white">{stats.personal}</p>
            </div>
            <div className="rounded-2xl border border-violet-300/20 bg-violet-400/5 px-4 py-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-violet-200">Shared Library</p>
              <p className="mt-1 text-xl font-semibold text-white">{stats.shared}</p>
            </div>
          </div>
        </header>

        {isAdmin ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-cyan-300/15 bg-cyan-300/8 px-4 py-3 text-sm text-cyan-50">
            <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-200" />
            Admin role active. Knowledge-base uploads are shared with all users after indexing.
          </div>
        ) : null}

        {/* Search & Status Filters */}
        {sources.length > 0 && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents by filename..."
                aria-label="Search documents"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 py-2.5 pl-10 pr-9 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-0.5 text-slate-400 hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "indexed", label: "Ready" },
                  { id: "indexing", label: "Indexing" },
                  { id: "failed", label: "Failed" },
                ] as const
              ).map((tab) => {
                const active = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "bg-cyan-300/15 text-cyan-50 ring-1 ring-cyan-300/30"
                        : "border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <SourceSection
            title="Knowledge Base"
            items={knowledgeBaseSources}
            canDelete={isAdmin}
            onDelete={handleDelete}
            onAskInChat={(source) => workspace?.focusDocumentInChat({ id: source.id, filename: source.filename })}
            emptyMessage={
              status === "loading"
                ? "Loading knowledge-base documents..."
                : searchQuery || statusFilter !== "all"
                  ? "No knowledge-base documents match your current filter."
                  : "No shared knowledge-base documents have been uploaded yet."
            }
          />
          <SourceSection
            title="Your Uploads"
            items={personalSources}
            canDelete
            onDelete={handleDelete}
            onAskInChat={(source) => workspace?.focusDocumentInChat({ id: source.id, filename: source.filename })}
            emptyMessage={
              status === "loading"
                ? "Loading your uploads..."
                : searchQuery || statusFilter !== "all"
                  ? "No personal uploads match your current filter."
                  : "No personal uploads yet. Click 'Upload notes' above to add PDFs, slides, or notes."
            }
          />
        </section>

        {status === "error" ? (
          <div
            role="alert"
            className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between"
          >
            <p>Could not load your document library. Your files have not been changed.</p>
            <button
              type="button"
              onClick={() => refreshSources({ force: true })}
              className="min-h-10 shrink-0 rounded-xl border border-amber-200/20 px-3 py-2 text-xs font-semibold text-amber-50 transition hover:bg-amber-200/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
            >
              Try again
            </button>
          </div>
        ) : null}
      </div>

      {!workspace && (
        <>
          <UploadModal
            isOpen={isUploadOpen}
            onClose={() => setIsUploadOpen(false)}
            uploadTarget={uploadTarget}
            onUploadToast={(toast) => {
              if (toast.documentId) {
                refreshSources({ force: true }).catch(() => {});
              }
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
          <IndexingToast
            toasts={uploadToasts}
            onDismiss={(toastId) => setUploadToasts((current) => current.filter((toast) => toast.toastId !== toastId))}
          />
        </>
      )}
    </div>
  );
}

type SourceSectionProps = {
  title: string;
  items: KnowledgeSource[];
  canDelete?: boolean;
  onDelete?: (sourceId: string) => void;
  onAskInChat?: (source: KnowledgeSource) => void;
  emptyMessage: string;
};

function getSourceCardClass(isFailed: boolean, isInProgress: boolean): string {
  if (isFailed) {
    return "rounded-3xl border border-red-400/50 bg-red-400/5 p-4 transition hover:border-red-400/70";
  }
  if (isInProgress) {
    return "status-ring status-ring-indexing rounded-3xl bg-slate-950/95 p-4";
  }
  return "rounded-3xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-300/25 hover:bg-white/[0.07]";
}

function SourceSection({
  title,
  items,
  canDelete = false,
  onDelete,
  onAskInChat,
  emptyMessage,
}: Readonly<SourceSectionProps>) {
  return (
    <section className="rounded-4xl border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-slate-950/30 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <StatusBadge tone="slate">{items.length}</StatusBadge>
      </div>
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => {
            const isFailed = item.status === "failed";
            const isInProgress = item.status !== "indexed" && !isFailed;
            const cardClass = getSourceCardClass(isFailed, isInProgress);
            const extLabel =
              item.fileType && item.fileType !== "unknown" ? item.fileType.toUpperCase() : "DOC";

            const body = (
              <div className="p-1">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
                        isFailed
                          ? "border-red-400/30 bg-red-400/10 text-red-300"
                          : "border-cyan-300/20 bg-cyan-300/10 text-cyan-200"
                      }`}
                    >
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate font-semibold ${isFailed ? "text-red-200" : "text-slate-100"}`}
                        title={item.filename}
                      >
                        {item.filename}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold text-slate-300">
                          {extLabel}
                        </span>
                        {item.status === "indexed" && (
                          <span className="inline-flex items-center gap-1 text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            Indexed
                          </span>
                        )}
                        {isInProgress && (
                          <span className="inline-flex items-center gap-1 text-purple-300">
                            <Clock className="h-3 w-3 animate-spin" />
                            Indexing…
                          </span>
                        )}
                        {isFailed && <span className="font-medium text-red-300">Failed</span>}
                        {item.createdAt && (
                          <span className="text-slate-500">
                            • {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {item.summary ? (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-red-200/80">{item.summary}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {item.status === "indexed" && onAskInChat && (
                      <button
                        type="button"
                        onClick={() => onAskInChat(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1.5 text-xs font-medium text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-300/20 active:scale-95"
                        title={`Ask IntelliSeek about ${item.filename}`}
                      >
                        <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                        <span>Ask AI</span>
                      </button>
                    )}
                    {canDelete && onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200 active:scale-90"
                        aria-label={`Delete ${item.filename}`}
                        title="Delete document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
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
        <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-500">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}
