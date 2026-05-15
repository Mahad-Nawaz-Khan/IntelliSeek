export type NavigationItem = {
  id: string;
  label: string;
  href?: string;
  icon?: string;
  status: "active" | "inactive" | "disabled";
  count?: number;
};

export type KnowledgeSource = {
  id: string;
  filename: string;
  sourceType: "built-in" | "uploaded";
  fileType?: "pdf" | "docx" | "pptx" | "txt" | "unknown";
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
  fileType: "pdf" | "docx" | "pptx" | "txt" | "unknown";
  sizeLabel?: string;
  progress?: number;
  status: "idle" | "uploading" | "indexing" | "indexed" | "failed";
  errorMessage?: string;
};

export type RetrievalMatch = {
  id: string;
  sourceId: string;
  filename: string;
  locator?: string;
  snippet?: string;
  scoreLabel?: string;
};

export type RetrievalStatus = {
  state: "idle" | "analyzing" | "retrieving" | "answering" | "complete" | "error";
  message: string;
  matches?: RetrievalMatch[];
};

export const BUILT_IN_SOURCES: KnowledgeSource[] = [
  {
    id: "built-in-dsa",
    filename: "DSA.pdf",
    sourceType: "built-in",
    fileType: "pdf",
    status: "available",
    summary: "Core algorithms, trees, graphs, recursion, and dynamic programming notes.",
  },
  {
    id: "built-in-ai-notes",
    filename: "AI_Notes.pdf",
    sourceType: "built-in",
    fileType: "pdf",
    status: "available",
    summary: "Semantic search, embeddings, retrieval, and answer generation concepts.",
  },
  {
    id: "built-in-lecture-3",
    filename: "Lecture_3.pptx",
    sourceType: "built-in",
    fileType: "pptx",
    status: "available",
    summary: "Traversal examples and academic explanation patterns.",
  },
];

export const SAMPLE_UPLOAD_ITEMS: UploadItem[] = [
  {
    id: "sample-upload-assignment",
    filename: "Assignment.pdf",
    fileType: "pdf",
    sizeLabel: "2.4 MB",
    progress: 100,
    status: "indexed",
  },
  {
    id: "sample-upload-oop",
    filename: "OOP_Notes.docx",
    fileType: "docx",
    sizeLabel: "1.1 MB",
    progress: 72,
    status: "indexing",
  },
];

export function getFileType(filename: string): KnowledgeSource["fileType"] {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "pdf" || extension === "docx" || extension === "pptx" || extension === "txt") {
    return extension;
  }
  return "unknown";
}

export function createSourceGroups(uploadedSources: KnowledgeSource[]): KnowledgeSourceGroup[] {
  return [
    {
      id: "knowledge-base",
      title: "Knowledge Base",
      emptyMessage: "Built-in academic sources will appear here.",
      sources: BUILT_IN_SOURCES,
    },
    {
      id: "your-uploads",
      title: "Your Uploads",
      emptyMessage: "Upload notes to build your personal source library.",
      sources: uploadedSources,
    },
  ];
}

export function createRecentChats(messages: { id: string; role: string; content: string; createdAt: number }[]): ChatSession[] {
  return messages
    .filter((message) => message.role === "user")
    .slice(-5)
    .reverse()
    .map((message) => ({
      id: message.id,
      title: message.content,
      lastMessageAt: new Date(message.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: "inactive" as const,
    }));
}
