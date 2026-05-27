"use client";

import { X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { readParseResponse } from "../../lib/parse-response";
import { supabase } from "../../lib/supabase";
import {
  ALLOWED_MIME_TYPES,
  BUCKET_NAME,
  getExtension,
  getStorageUploadErrorMessage,
  isAllowedFile,
  type AllowedExtension,
} from "../../lib/upload-config";
import type { UploadItem } from "../../lib/ui-state";
import { UploadDropzone } from "./UploadDropzone";
import { UploadProgress } from "./UploadProgress";

type UploadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onQueued?: (documentId: string) => void;
  completedDocumentIds?: Set<string>;
  failedDocuments?: Map<string, string>;
};

function toSizeLabel(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function toFileType(filename: string): UploadItem["fileType"] {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "pdf" || extension === "docx" || extension === "pptx" || extension === "txt") return extension;
  return "unknown";
}

export function UploadModal({ isOpen, onClose, onQueued, completedDocumentIds, failedDocuments }: UploadModalProps) {
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

  const processFile = useCallback(async (file: File) => {
    setLastFile(file);
    const baseItem: UploadItem = {
      id: `${Date.now()}-${file.name}`,
      filename: file.name,
      fileType: toFileType(file.name),
      sizeLabel: toSizeLabel(file.size),
      progress: 0,
      status: "idle",
    };

    const check = isAllowedFile(file);
    if (!check.valid) {
      setItem({ ...baseItem, status: "failed", errorMessage: check.error ?? "Invalid file" });
      return;
    }

    if (!isLoaded) {
      setItem({ ...baseItem, status: "failed", errorMessage: "Authentication is still loading" });
      return;
    }

    if (!isSignedIn || !user) {
      setItem({ ...baseItem, status: "failed", errorMessage: "Sign in before uploading notes" });
      return;
    }

    if (!supabase) {
      setItem({ ...baseItem, status: "failed", errorMessage: "Supabase client is not configured" });
      return;
    }

    const userId = user.id;

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${userId}/${timestamp}-${safeName}`;

    setItem({ ...baseItem, progress: 35, status: "uploading" });
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, file, { upsert: false });

    if (uploadError) {
      setItem({ ...baseItem, status: "failed", errorMessage: getStorageUploadErrorMessage(uploadError.message) });
      return;
    }

    setItem({ ...baseItem, progress: 78, status: "indexing" });
    try {
      const ext = getExtension(file.name) as AllowedExtension;
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storage_path: storagePath,
          filename: file.name,
          file_type: ALLOWED_MIME_TYPES[ext],
          file_size: file.size,
        }),
      });
      const result = await readParseResponse(response);

      if (!result.ok) {
        setItem({ ...baseItem, status: "failed", errorMessage: result.error ?? "Parsing failed" });
        return;
      }

      if (!result.document_id) {
        setItem({ ...baseItem, status: "failed", errorMessage: "Queued document did not return an id" });
        return;
      }

      setQueuedDocumentId(result.document_id);
      setItem({ ...baseItem, progress: 88, status: "indexing" });
      onQueued?.(result.document_id);
    } catch (error) {
      setItem({ ...baseItem, status: "failed", errorMessage: error instanceof Error ? error.message : "Could not reach the parsing service" });
    }
  }, [isLoaded, isSignedIn, onQueued, user]);

  if (!isOpen) return null;

  const isWorking = displayedItem?.status === "uploading" || displayedItem?.status === "indexing";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Upload documents">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-950/95 p-5 shadow-2xl shadow-slate-950/60">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">Upload notes</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Add academic material</h2>
            <p className="mt-2 text-sm text-slate-400">Files are uploaded, parsed, indexed, and made available for source-grounded answers.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white" aria-label="Close upload modal">
            <X className="h-5 w-5" />
          </button>
        </div>

        <UploadDropzone
          disabled={isWorking || !isLoaded || !isSignedIn}
          isDragging={isDragging}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) processFile(file);
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
            const file = event.dataTransfer.files[0];
            if (file) processFile(file);
          }}
        />

        {displayedItem && (
          <div className="mt-4">
            <UploadProgress item={displayedItem} onRetry={lastFile ? () => processFile(lastFile) : undefined} />
          </div>
        )}
      </div>
    </div>
  );
}
