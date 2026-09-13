export type KnowledgeSource = {
  id: string;
  filename: string;
  sourceType: "knowledge-base" | "uploaded";
  fileType?: "pdf" | "docx" | "pptx" | "txt" | "md" | "unknown";
  status: "available" | "indexing" | "indexed" | "failed";
  createdAt?: string;
  summary?: string;
};

export type KnowledgeSourceGroup = {
  id: string;
  title: string;
  emptyMessage: string;
  sources: KnowledgeSource[];
};

export type ChatSession = {
  id: string;
  title: string;
  lastMessageAt?: string;
  status: "active" | "inactive";
};

export type Citation = {
  id: string;
  sourceId: string;
  label: string;
  filename: string;
  locator?: string;
  preview?: string;
};

export type UploadItem = {
  id: string;
  filename: string;
  fileType: "pdf" | "docx" | "pptx" | "txt" | "md" | "unknown";
  sizeLabel?: string;
  progress?: number;
  status: "idle" | "uploading" | "indexing" | "indexed" | "failed";
  errorMessage?: string;
};

export function getFileType(filename: string): KnowledgeSource["fileType"] {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "pdf" || extension === "docx" || extension === "pptx" || extension === "txt" || extension === "md") {
    return extension;
  }
  return "unknown";
}

export function createSourceGroups(uploadedSources: KnowledgeSource[]): KnowledgeSourceGroup[] {
  const knowledgeBaseSources = uploadedSources.filter((source) => source.sourceType === "knowledge-base");
  const personalSources = uploadedSources.filter((source) => source.sourceType === "uploaded");

  return [
    {
      id: "knowledge-base",
      title: "Knowledge Base",
      emptyMessage: "No shared knowledge-base documents have been uploaded yet.",
      sources: knowledgeBaseSources,
    },
    {
      id: "your-uploads",
      title: "Your Uploads",
      emptyMessage: "Upload notes to build your personal source library.",
      sources: personalSources,
    },
  ];
}
