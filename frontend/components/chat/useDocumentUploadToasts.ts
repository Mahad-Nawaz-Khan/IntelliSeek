"use client";

import { useCallback, useEffect, useState } from "react";
import type { UploadIndexingToast } from "../upload/IndexingToast";
import type { UploadToastPayload } from "../../lib/upload-document";

type UseDocumentUploadToastsParams = {
  completedDocumentIds: Set<string>;
  failedDocuments: Map<string, string>;
  onNewIndexingDocument?: () => void;
};

export function useDocumentUploadToasts({
  completedDocumentIds,
  failedDocuments,
  onNewIndexingDocument,
}: UseDocumentUploadToastsParams) {
  const [uploadToasts, setUploadToasts] = useState<UploadIndexingToast[]>([]);

  // Update toast status from polling results
  useEffect(() => {
    setUploadToasts((current) =>
      current.map((toast) => {
        if (toast.status !== "uploading" && toast.status !== "indexing") return toast;

        if (toast.documentId && completedDocumentIds.has(toast.documentId)) {
          return { ...toast, status: "completed" as const };
        }

        const failure = toast.documentId ? failedDocuments.get(toast.documentId) : undefined;
        if (failure) {
          return { ...toast, status: "failed" as const, errorMessage: failure };
        }

        return toast;
      }),
    );
  }, [completedDocumentIds, failedDocuments]);

  // Auto-dismiss completed toasts after green flash
  useEffect(() => {
    const completedIds = uploadToasts
      .filter((t) => t.status === "completed")
      .map((t) => t.toastId);

    if (completedIds.length === 0) return;

    const timeout = window.setTimeout(() => {
      setUploadToasts((current) => current.filter((t) => !completedIds.includes(t.toastId)));
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [uploadToasts]);

  const dismissToast = useCallback((toastId: string) => {
    setUploadToasts((current) => current.filter((t) => t.toastId !== toastId));
  }, []);

  const handleUploadToast = useCallback(
    ({ toastId, documentId, filename, status, queuedAt, errorMessage }: UploadToastPayload) => {
      if (documentId) onNewIndexingDocument?.();
      setUploadToasts((current) => {
        const existing = current.find((t) => t.toastId === toastId);
        const nextToast: UploadIndexingToast = {
          toastId,
          documentId: documentId ?? existing?.documentId,
          filename,
          queuedAt: queuedAt ?? existing?.queuedAt ?? Date.now(),
          status,
          errorMessage,
        };

        return [...current.filter((t) => t.toastId !== toastId), nextToast];
      });
    },
    [onNewIndexingDocument],
  );

  return {
    uploadToasts,
    dismissToast,
    handleUploadToast,
  };
}
