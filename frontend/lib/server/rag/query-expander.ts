import { getServerEnv } from "../env";
import type { RequestLogger } from "../logger";

const EXPANSION_SYSTEM_PROMPT = `Given an academic search query, generate 2-3 concise keyword-dense variations, related technical terms, or synonyms that help find relevant sections in study materials. Return ONLY a JSON array of strings with no markdown formatting.

Examples:
"binary search tree" -> ["binary search tree", "BST node left right", "tree balancing search complexity"]
"photosynthesis" -> ["photosynthesis", "light-dependent reactions Calvin cycle", "chloroplast thylakoid ATP"]
"normalization" -> ["database normalization", "first second third normal form 1NF 2NF 3NF", "Boyce-Codd BCNF redundancy"]`;

export async function expandQuery(query: string, log?: RequestLogger): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 3) return [query];

  const apiKey = getServerEnv("GROQ_API_KEY");
  if (!apiKey) {
    return [trimmed];
  }

  try {
    const { default: Groq } = await import("groq-sdk");
    const client = new Groq({ apiKey, timeout: 4000 });

    const response = await client.chat.completions.create({
      model: getServerEnv("GROQ_CHAT_MODEL") ?? "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: EXPANSION_SYSTEM_PROMPT },
        { role: "user", content: trimmed },
      ],
      temperature: 0.1,
      max_tokens: 120,
    });

    const content = response.choices?.[0]?.message?.content?.trim() ?? "";
    const cleanJson = content.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleanJson);

    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      const unique = [...new Set([trimmed, ...parsed])].filter(Boolean).slice(0, 4);
      log?.info("query.expanded", { original: trimmed, expansionsCount: unique.length });
      return unique;
    }
  } catch (error) {
    log?.warn("query.expansion.fallback", { query: trimmed, error: String(error) });
  }

  return [trimmed];
}

