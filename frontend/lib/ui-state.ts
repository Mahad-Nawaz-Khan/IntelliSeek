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

export type SourceStatus = "loading" | "ready" | "empty" | "unavailable";

export function isSourcesResolved(status: SourceStatus): boolean {
  return status === "ready" || status === "empty";
}

export function hasPersonalUploadedSources(sources: KnowledgeSource[]): boolean {
  return sources.some((source) => source.sourceType === "uploaded" && source.status !== "failed");
}

export function shouldShowWelcomeUploadCta(options: {
  sourceStatus: SourceStatus;
  hasPersonalSources: boolean;
  isDemo?: boolean;
  isTemporaryChat?: boolean;
}): boolean {
  const { sourceStatus, hasPersonalSources, isDemo = false, isTemporaryChat = false } = options;
  if (isDemo || isTemporaryChat) return false;
  if (!isSourcesResolved(sourceStatus)) return false;
  return !hasPersonalSources;
}

/** Returns whether a document can be included as selectable chat context. */
export function isSelectableSource(source: KnowledgeSource): boolean {
  return source.status !== "failed";
}

/** Filters accessible sources down to those enabled by source checkboxes and Knowledge Base toggle. */
export function getSelectedSources(
  sources: KnowledgeSource[],
  excludedSourceIds: readonly string[],
  includeKnowledgeBase = true,
): KnowledgeSource[] {
  const excluded = new Set(excludedSourceIds);
  return sources.filter((source) => {
    if (!isSelectableSource(source)) return false;
    if (source.sourceType === "knowledge-base" && !includeKnowledgeBase) return false;
    return !excluded.has(source.id);
  });
}

/** Formats the compact source selector count label (e.g. "1 Source", "2 Sources"). */
export function formatSourcesButtonLabel(selectedCount: number): string {
  return `${selectedCount} ${selectedCount === 1 ? "Source" : "Sources"}`;
}

/** Computes updated exclusions and KB re-enable state when toggling a single source checkbox. */
export function computeSourceToggleResult(
  sources: KnowledgeSource[],
  excludedSourceIds: readonly string[],
  sourceId: string,
  includeKnowledgeBase: boolean,
): { excludedSourceIds: string[]; enableKnowledgeBase: boolean } {
  const target = sources.find((item) => item.id === sourceId);
  if (target?.sourceType === "knowledge-base" && !includeKnowledgeBase) {
    const next = new Set(excludedSourceIds);
    next.delete(sourceId);
    for (const item of sources) {
      if (item.sourceType === "knowledge-base" && item.id !== sourceId && isSelectableSource(item)) {
        next.add(item.id);
      }
    }
    return { excludedSourceIds: Array.from(next), enableKnowledgeBase: true };
  }

  return {
    excludedSourceIds: excludedSourceIds.includes(sourceId)
      ? excludedSourceIds.filter((id) => id !== sourceId)
      : [...excludedSourceIds, sourceId],
    enableKnowledgeBase: false,
  };
}

/** Computes updated exclusions and KB re-enable state when toggling a section checkbox. */
export function computeSectionSelectionResult(
  sources: KnowledgeSource[],
  excludedSourceIds: readonly string[],
  sourceType: KnowledgeSource["sourceType"],
  selected: boolean,
  includeKnowledgeBase: boolean,
): { excludedSourceIds: string[]; enableKnowledgeBase: boolean } {
  const sectionIds = sources
    .filter((item) => item.sourceType === sourceType && isSelectableSource(item))
    .map((item) => item.id);
  if (!sectionIds.length) {
    return { excludedSourceIds: [...excludedSourceIds], enableKnowledgeBase: false };
  }

  const sectionIdSet = new Set(sectionIds);
  if (selected) {
    return {
      excludedSourceIds: excludedSourceIds.filter((id) => !sectionIdSet.has(id)),
      enableKnowledgeBase: sourceType === "knowledge-base" && !includeKnowledgeBase,
    };
  }

  return {
    excludedSourceIds: Array.from(new Set([...excludedSourceIds, ...sectionIds])),
    enableKnowledgeBase: false,
  };
}

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
