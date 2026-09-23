"use client";

import { X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { uploadDocumentFile, type UploadToastPayload } from "../../lib/upload-document";
import type { UploadItem } from "../../lib/ui-state";
import { UploadDropzone } from "./UploadDropzone";
import { UploadProgress } from "./UploadProgress";

type UploadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  uploadTarget?: "personal" | "knowledge_base";
  onUploadToast?: (payload: UploadToastPayload) => void;
  completedDocumentIds?: Set<string>;
  failedDocuments?: Map<string, string>;
};

export function UploadModal({
  isOpen,
  onClose,
  uploadTarget = "personal",
  onUploadToast,
  completedDocumentIds,
  failedDocuments,
}: Readonly<UploadModalProps>) {
  const { isLoaded, isSignedIn, user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [item, setItem] = useState<UploadItem | null>(null);
  const [queuedDocumentId, setQueuedDocumentId] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  const displayedItem = useMemo(() => {
    if (!item || !queuedDocumentId) return item;

    if (completedDocumentIds?.has(queuedDocumentId)) {
      return { ...item, progress: 100, status: "indexed" as const };
    }

    const failure = failedDocuments?.get(queuedDocumentId);
    if (failure) {
      return { ...item, status: "failed" as const, errorMessage: failure };
    }

    return item;
  }, [completedDocumentIds, failedDocuments, item, queuedDocumentId]);

  const processFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      if (files.length === 1) {
        const [file] = files;
        setLastFile(file);
        await uploadDocumentFile({
          file,
          userId: user?.id,
          isAuthLoaded: isLoaded,
          isSignedIn,
          uploadTarget,
          onToast: onUploadToast,
          onUploadStarted: onClose,
          onProgress: (nextItem, documentId) => {
            setItem(nextItem);
            if (documentId) setQueuedDocumentId(documentId);
          },
        });
        return;
      }

      // Multiple files: close modal and upload each file concurrently with toast notifications
      onClose();
      await Promise.all(
        files.map((file) =>
          uploadDocumentFile({
            file,
            userId: user?.id,
            isAuthLoaded: isLoaded,
            isSignedIn,
            uploadTarget,
            onToast: onUploadToast,
            toastValidationFailures: true,
          }),
        ),
      );
    },
    [isLoaded, isSignedIn, onClose, onUploadToast, uploadTarget, user],
  );

  if (!isOpen) return null;

  const isWorking = displayedItem?.status === "uploading" || displayedItem?.status === "indexing";

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-full max-h-full w-full max-w-full items-center justify-center border-none bg-slate-950/80 p-4 backdrop-blur-sm"
      aria-label="Upload documents"
    >
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-950/95 p-5 shadow-2xl shadow-slate-950/60">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
              {uploadTarget === "knowledge_base" ? "Admin upload" : "Upload notes"}
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              {uploadTarget === "knowledge_base" ? "Add to knowledge base" : "Add academic material"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {uploadTarget === "knowledge_base"
                ? "Files are indexed as shared knowledge-base sources for all users."
                : "Files are uploaded, parsed, indexed, and made available for source-grounded answers."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Close upload modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <UploadDropzone
          disabled={isWorking || !isLoaded || !isSignedIn}
          isDragging={isDragging}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length) processFiles(files);
            event.target.value = "";
          }}
          onDragLeave={() => setIsDragging(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const files = Array.from(event.dataTransfer.files ?? []);
            if (files.length) processFiles(files);
          }}
        />

        {displayedItem && (
          <div className="mt-4">
            <UploadProgress
              item={displayedItem}
              onRetry={lastFile ? () => processFiles([lastFile]) : undefined}
            />
          </div>
        )}
      </div>
    </dialog>
  );
}
