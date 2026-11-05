import { getServerEnv } from "../env";
import type { RequestLogger } from "../logger";
import type { RetrievedContext } from "./retriever";

const RERANK_SYSTEM_PROMPT = `You are a precision relevance scorer for academic search.
Given a user query and a numbered list of retrieved text snippets from study documents, output a JSON array of indices ordered from MOST relevant to LEAST relevant to answering the query.
Return ONLY a valid JSON array of numbers (e.g. [2, 0, 1]). Do not include explanations.`;

export async function rerankChunks(
  question: string,
  chunks: RetrievedContext[],
  log?: RequestLogger,
): Promise<RetrievedContext[]> {
  if (chunks.length <= 2) return chunks;

  const apiKey = getServerEnv("GROQ_API_KEY");
  if (!apiKey) return chunks;

  const targetChunks = chunks.slice(0, 10);

  try {
    const { default: Groq } = await import("groq-sdk");
    const client = new Groq({ apiKey, timeout: 5000 });

    const snippets = targetChunks
      .map((c, i) => `[${i}] ${c.text_content.slice(0, 280).replace(/\s+/g, " ").trim()}`)
      .join("\n\n");

    const prompt = `Query: "${question}"\n\nSnippets:\n${snippets}`;

    const response = await client.chat.completions.create({
      model: getServerEnv("GROQ_CHAT_MODEL") ?? "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: RERANK_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.0,
      max_tokens: 80,
    });

    const content = response.choices?.[0]?.message?.content?.trim() ?? "";
    const cleanJson = content.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
    const rankedIndices = JSON.parse(cleanJson);

    if (Array.isArray(rankedIndices) && rankedIndices.every((n) => typeof n === "number")) {
      const validIndices = rankedIndices.filter((idx) => idx >= 0 && idx < targetChunks.length);
      const rankedSet = new Set(validIndices);

      const reranked: RetrievedContext[] = validIndices.map((idx, rankPosition) => ({
        ...targetChunks[idx],
        score: Math.max(targetChunks[idx].score, 0.95 - rankPosition * 0.04),
      }));

      // Append any unranked items preserving their original relative order
      targetChunks.forEach((chunk, idx) => {
        if (!rankedSet.has(idx)) {
          reranked.push(chunk);
        }
      });

      // Append any remaining chunks beyond the top 10
      if (chunks.length > 10) {
        reranked.push(...chunks.slice(10));
      }

      log?.info("retrieval.rerank.complete", {
        candidateCount: chunks.length,
        rerankedCount: reranked.length,
      });

      return reranked;
    }
  } catch (error) {
    log?.warn("retrieval.rerank.fallback", { error: String(error) });
  }

  return chunks;
}

