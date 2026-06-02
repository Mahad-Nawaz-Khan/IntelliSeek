import { UploadCloud } from "lucide-react";
import type { ChangeEvent, DragEvent } from "react";

type UploadDropzoneProps = {
  disabled?: boolean;
  isDragging: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDragLeave: () => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
};

export function UploadDropzone({
  disabled = false,
  isDragging,
  onChange,
  onDragLeave,
  onDragOver,
  onDrop,
}: UploadDropzoneProps) {
  return (
    <label
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`group flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition ${
        isDragging
          ? "border-cyan-300 bg-cyan-300/10 shadow-lg shadow-cyan-950/30"
          : "border-white/15 bg-slate-950/45 hover:border-cyan-300/40 hover:bg-cyan-300/5"
      } ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200 transition group-hover:bg-cyan-300/15">
        <UploadCloud className="h-7 w-7" />
      </span>
      <span className="text-lg font-semibold text-white">Drag & Drop Files Here</span>
      <span className="mt-2 text-sm text-slate-400">PDF • DOCX • PPTX • TXT • MD</span>
      <span className="mt-1 text-xs text-slate-500">Maximum 10 MB per file</span>
      <input
        type="file"
        accept=".pdf,.docx,.pptx,.txt,.md"
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
    </label>
  );
}
