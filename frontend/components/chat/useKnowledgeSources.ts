"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAccessibleDocuments } from "../../lib/documents";
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

export function useKnowledgeSources({ demo, isLoaded, isSignedIn }: UseKnowledgeSourcesParams) {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [sourceStatus, setSourceStatus] = useState<"loading" | "ready" | "empty" | "unavailable">("loading");
  const [pollDocuments, setPollDocuments] = useState(false);
  const [serverAutocompleteSuggestions, setServerAutocompleteSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);

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
        setSources(rows);
        setPollDocuments(rows.some((source) => source.status === "indexing"));
        setSourceStatus(rows.length ? "ready" : "empty");
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
        const rows = await fetchAccessibleDocuments();
        if (!active) return;

        const hasIndexingSources = rows.some((source) => source.status === "indexing");
        setSources(rows);
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
    if (deletingSourceId || demo) return;

    setDeletingSourceId(sourceId);
    try {
      const response = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: sourceId }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !result?.ok) throw new Error(result?.error ?? "Document deletion failed");

      setSources((current) => current.filter((source) => source.id !== sourceId));
      setServerAutocompleteSuggestions([]);
    } catch {
      setSourceStatus("unavailable");
    } finally {
      setDeletingSourceId(null);
    }
  }, [demo, deletingSourceId]);

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
  };
}
