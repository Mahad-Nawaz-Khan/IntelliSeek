"use client";

import { useCallback, useState } from "react";

import { getBackendUrl } from "../lib/config";
import { supabase } from "../lib/supabase";
import {
  ALLOWED_MIME_TYPES,
  BUCKET_NAME,
  getExtension,
  isAllowedFile,
  type AllowedExtension,
} from "../lib/upload-config";

type UploadStatus =
  | "idle"
  | "validated"
  | "uploading"
  | "uploaded"
  | "parsing"
  | "parsed"
  | "failed";

type ParseResult = {
  ok: boolean;
  status?: string;
  document_id?: string;
  filename?: string;
  text_preview?: string;
  error?: string;
};

export function FileUpload() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [textPreview, setTextPreview] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const reset = useCallback(() => {
    setStatus("idle");
    setFileName("");
    setError("");
    setDocumentId("");
    setTextPreview("");
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      reset();
      const check = isAllowedFile(file);
      if (!check.valid) {
        setError(check.error ?? "Invalid file");
        setStatus("failed");
        return;
      }

      setFileName(file.name);
      setStatus("validated");

      if (!supabase) {
        setError("Supabase client is not configured");
        setStatus("failed");
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (userError || !userId) {
        setError("You must be signed in before uploading documents");
        setStatus("failed");
        return;
      }

      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${userId}/${timestamp}-${safeName}`;

      setStatus("uploading");
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, file, { upsert: false });

      if (uploadError) {
        setError(uploadError.message);
        setStatus("failed");
        return;
      }

      setStatus("uploaded");

      // Trigger backend parse
      setStatus("parsing");
      try {
        const ext = getExtension(file.name) as AllowedExtension;
        const response = await fetch(getBackendUrl("/api/parse"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storage_path: storagePath,
            filename: file.name,
            file_type: ALLOWED_MIME_TYPES[ext],
            file_size: file.size,
            user_id: userId,
          }),
        });

        const result: ParseResult = await response.json();

        if (result.ok) {
          setDocumentId(result.document_id ?? "");
          setTextPreview(result.text_preview ?? "");
          setStatus("parsed");
        } else {
          setError(result.error ?? "Parsing failed");
          setStatus("failed");
        }
      } catch {
        setError("Could not reach the parsing service");
        setStatus("failed");
      }
    },
    [reset],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = "";
    },
    [processFile],
  );

  const isWorking =
    status === "uploading" || status === "parsing";

  return (
    <div className="flex flex-col gap-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-cyan-400 bg-cyan-500/10"
            : "border-slate-600 bg-slate-800/50 hover:border-slate-500"
        } ${isWorking ? "pointer-events-none opacity-60" : "cursor-pointer"}`}
      >
        <p className="text-lg font-medium text-slate-200">
          {isWorking
            ? status === "uploading"
              ? "Uploading..."
              : "Parsing document..."
            : "Drag and drop an academic file here, or click to browse"}
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Supported: PDF, DOCX, PPTX, TXT — Max 10 MB
        </p>
        <input
          type="file"
          accept=".pdf,.docx,.pptx,.txt"
          onChange={handleChange}
          disabled={isWorking}
          className="mx-auto mt-4 block text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-cyan-500 disabled:opacity-50"
        />
      </div>

      {status === "failed" && error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-200">{error}</p>
        </div>
      )}

      {status === "parsed" && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-sm font-medium text-emerald-200">
            Document parsed successfully
          </p>
          <p className="mt-1 text-xs text-emerald-100/70">
            File: {fileName} | Document ID: {documentId}
          </p>
          {textPreview && (
            <p className="mt-2 text-xs text-emerald-100/60 line-clamp-3">
              Preview: {textPreview}
            </p>
          )}
        </div>
      )}

      {status === "uploaded" && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
          <p className="text-sm font-medium text-cyan-200">
            File uploaded to storage. Waiting for parsing...
          </p>
        </div>
      )}

      {status !== "idle" && (
        <button
          onClick={reset}
          className="self-start rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600"
        >
          Upload another file
        </button>
      )}
    </div>
  );
}
