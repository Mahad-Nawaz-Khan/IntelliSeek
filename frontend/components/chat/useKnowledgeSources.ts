"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteDocumentById, fetchAccessibleDocuments, invalidateDocumentsCache } from "../../lib/documents";
import type { KnowledgeSource } from "../../lib/ui-state";
import type { AutocompleteSuggestion } from "../../lib/trie-autocomplete";

type AutocompleteResponse = {
  ok: boolean;
  suggestions?: AutocompleteSuggestion[];
};

type UseKnowledgeSourcesParams = {
  demo: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
};

function filterAutocompleteForDeletedDocument(
  suggestions: AutocompleteSuggestion[],
  deletedDocumentId: string,
): AutocompleteSuggestion[] {
  return suggestions.flatMap((suggestion) => {
    const meta = suggestion.metadata;
    if (!meta) return [suggestion];
    if (meta.kind === "document") {
      return meta.documentId === deletedDocumentId ? [] : [suggestion];
    }
    if (meta.kind === "topic") {
      const remainingDocIds = meta.documentIds.filter((id) => id !== deletedDocumentId);
      if (remainingDocIds.length === 0) return [];
      return [
        {
          ...suggestion,
          metadata: {
            ...meta,
            documentIds: remainingDocIds,
          },
        },
      ];
    }
    return [suggestion];
  });
}

export function useKnowledgeSources({ demo, isLoaded, isSignedIn }: UseKnowledgeSourcesParams) {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [sourceStatus, setSourceStatus] = useState<"loading" | "ready" | "empty" | "unavailable">("loading");
  const [pollDocuments, setPollDocuments] = useState(false);
  const [serverAutocompleteSuggestions, setServerAutocompleteSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const inFlightDeletesRef = useRef<Set<string>>(new Set());

  const refreshSources = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    if (demo) return;
    try {
      const rows = await fetchAccessibleDocuments({ force });
      const filteredRows = rows.filter((row) => !inFlightDeletesRef.current.has(row.id));
      setSources(filteredRows);
      setPollDocuments(filteredRows.some((source) => source.status === "indexing"));
      setSourceStatus(filteredRows.length ? "ready" : "empty");
    } catch {
      setSourceStatus("unavailable");
    }
  }, [demo]);

  useEffect(() => {
    if (demo) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      setSources([]);
      setSourceStatus("unavailable");
      return;
    }

    let active = true;

    async function loadSources() {
      try {
        const rows = await fetchAccessibleDocuments();
        if (!active) return;
        const filteredRows = rows.filter((row) => !inFlightDeletesRef.current.has(row.id));
        setSources(filteredRows);
        setPollDocuments(filteredRows.some((source) => source.status === "indexing"));
        setSourceStatus(filteredRows.length ? "ready" : "empty");
      } catch {
        if (active) setSourceStatus("unavailable");
      }
    }

    async function loadAutocomplete() {
      try {
        const response = await fetch("/api/autocomplete");
        const result = (await response.json()) as AutocompleteResponse;
        if (active && response.ok && result.ok) setServerAutocompleteSuggestions(result.suggestions ?? []);
      } catch {
        if (active) setServerAutocompleteSuggestions([]);
      }
    }

    loadSources();
    loadAutocomplete();

    return () => {
      active = false;
    };
  }, [demo, isLoaded, isSignedIn]);

  useEffect(() => {
    if (demo || !pollDocuments) return;

    let active = true;

    async function refreshIndexedState() {
      try {
        const rows = await fetchAccessibleDocuments({ force: true });
        if (!active) return;

        const filteredRows = rows.filter((row) => !inFlightDeletesRef.current.has(row.id));
        const hasIndexingSources = filteredRows.some((source) => source.status === "indexing");
        setSources(filteredRows);
        setSourceStatus(filteredRows.length ? "ready" : "empty");
        setPollDocuments(hasIndexingSources);

        const autocompleteResponse = await fetch("/api/autocomplete");
        const autocompleteResult = (await autocompleteResponse.json()) as AutocompleteResponse;
        if (active && autocompleteResponse.ok && autocompleteResult.ok) {
          setServerAutocompleteSuggestions(autocompleteResult.suggestions ?? []);
        }
      } catch {
      }
    }

    refreshIndexedState();
    const interval = window.setInterval(refreshIndexedState, 3000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [pollDocuments, demo]);

  const handleDeleteSource = useCallback(async (sourceId: string) => {
    if (demo || inFlightDeletesRef.current.has(sourceId)) return;

    inFlightDeletesRef.current.add(sourceId);
    let removedSource: KnowledgeSource | undefined;
    let removedIndex = -1;

    // Optimistically remove immediately so the sidebar feels instant
    setSources((current) => {
      removedIndex = current.findIndex((source) => source.id === sourceId);
      if (removedIndex !== -1) {
        removedSource = current[removedIndex];
      }
      const next = current.filter((source) => source.id !== sourceId);
      setSourceStatus(next.length ? "ready" : "empty");
      return next;
    });
    setServerAutocompleteSuggestions((current) =>
      filterAutocompleteForDeletedDocument(current, sourceId),
    );
    invalidateDocumentsCache();

    try {
      await deleteDocumentById(sourceId);
    } catch {
      // Roll back optimistic removal if server deletion fails
      if (removedSource) {
        const sourceToRestore = removedSource;
        setSources((current) => {
          if (current.some((s) => s.id === sourceId)) return current;
          const next = [...current];
          const insertAt = removedIndex >= 0 && removedIndex <= next.length ? removedIndex : 0;
          next.splice(insertAt, 0, sourceToRestore);
          setSourceStatus(next.length ? "ready" : "empty");
          return next;
        });
      }
    } finally {
      inFlightDeletesRef.current.delete(sourceId);
      setDeletingSourceId(null);
    }
  }, [demo]);

  return {
    sources,
    setSources,
    sourceStatus,
    setSourceStatus,
    pollDocuments,
    setPollDocuments,
    serverAutocompleteSuggestions,
    setServerAutocompleteSuggestions,
    deletingSourceId,
    handleDeleteSource,
    refreshSources,
  };
}
