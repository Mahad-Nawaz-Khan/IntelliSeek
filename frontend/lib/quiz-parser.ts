export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  source?: string;
};

export type QuizPayload = {
  title: string;
  questions: QuizQuestion[];
};

export type ParsedQuizContent = {
  beforeText: string;
  afterText: string;
  quiz: QuizPayload | null;
  isGeneratingQuiz: boolean;
};

export const QUIZ_SYSTEM_INSTRUCTIONS = `Interactive Quiz Formatting Rules:
- The user requested a multiple-choice practice quiz.
- Write at most 1 short introductory sentence, then output a single fenced code block tagged \`\`\`quiz containing strictly valid JSON matching this schema:
\`\`\`quiz
{
  "title": "Short Quiz Title",
  "questions": [
    {
      "question": "Clear multiple-choice question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Concise explanation of why this option is correct and why the distractors are incorrect.",
      "source": "exact_filename.pdf"
    }
  ]
}
\`\`\`
- Generate 4 to 5 well-crafted questions (unless the user asked for a specific count between 2 and 10).
- Each question must have 4 distinct options and a valid 0-based integer \`correctIndex\` (0, 1, 2, or 3).
- Use only filenames present in the retrieved context for \`source\`, or omit \`source\` if answering from general academic knowledge.
- Do not repeat the questions or answers outside the \`\`\`quiz block, and do not include trailing commas in JSON.`;

export function isQuizRequest(question: string): boolean {
  const trimmed = question.trim();
  if (!trimmed) return false;
  if (/^\/quiz\b/i.test(trimmed)) return true;
  if (/\[interactive-quiz\]/i.test(trimmed)) return true;
  if (/^quiz\s+(?:me|us)\b/i.test(trimmed)) return true;
  return /\b(?:create|generate|make|give\s+me|start|build)\b[\s\S]{0,80}\b(?:interactive\s+)?(?:quiz|quizzes|multiple[- ]choice|mcqs?)\b/i.test(
    trimmed,
  );
}

function stripTrailingCommas(jsonText: string): string {
  return jsonText.replace(/,\s*([}\]])/g, "$1");
}

function normalizeQuizPayload(raw: unknown): QuizPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  if (!Array.isArray(candidate.questions)) return null;

  const questions: QuizQuestion[] = [];
  candidate.questions.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const questionText = typeof record.question === "string" ? record.question.trim() : "";
    if (!questionText) return;

    const rawOptions = Array.isArray(record.options)
      ? record.options
          .filter((opt): opt is string => typeof opt === "string")
          .map((opt) => opt.trim())
          .filter(Boolean)
          .slice(0, 6)
      : [];

    if (rawOptions.length < 2) return;

    const rawIndex = typeof record.correctIndex === "number" && Number.isFinite(record.correctIndex)
      ? Math.trunc(record.correctIndex)
      : 0;
    const correctIndex = Math.max(0, Math.min(rawOptions.length - 1, rawIndex));

    const explanation =
      typeof record.explanation === "string" && record.explanation.trim()
        ? record.explanation.trim()
        : "Review the highlighted answer and source notes for full details.";
    const source =
      typeof record.source === "string" && record.source.trim()
        ? record.source.trim()
        : undefined;

    questions.push({
      id: `q-${index + 1}`,
      question: questionText,
      options: rawOptions,
      correctIndex,
      explanation,
      ...(source ? { source } : {}),
    });
  });

  if (!questions.length) return null;

  const title =
    typeof candidate.title === "string" && candidate.title.trim()
      ? candidate.title.trim()
      : "Practice Quiz";

  return { title, questions };
}

function tryParseQuizJson(rawBlock: string): QuizPayload | null {
  const cleaned = stripTrailingCommas(rawBlock.trim());
  if (!cleaned.startsWith("{")) return null;
  try {
    return normalizeQuizPayload(JSON.parse(cleaned));
  } catch {
    return null;
  }
}

const COMPLETED_FENCE_REGEX = /```(quiz|json)\s*\r?\n([\s\S]*?)```/gi;
const OPEN_QUIZ_FENCE_REGEX = /```quiz\b/i;

export function parseQuizFromContent(
  content: string,
  isStreaming = false,
): ParsedQuizContent {
  if (!content) {
    return { beforeText: "", afterText: "", quiz: null, isGeneratingQuiz: false };
  }

  COMPLETED_FENCE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = COMPLETED_FENCE_REGEX.exec(content)) !== null) {
    const lang = match[1].toLowerCase();
    const inner = match[2] ?? "";
    if (lang === "json" && !/"questions"\s*:/.test(inner)) {
      continue;
    }

    const quiz = tryParseQuizJson(inner);
    if (quiz) {
      const beforeText = content.slice(0, match.index).trim();
      const afterText = content.slice(match.index + match[0].length).trim();
      return {
        beforeText,
        afterText,
        quiz,
        isGeneratingQuiz: false,
      };
    }
  }

  // While streaming, hide an unclosed ```quiz (or ```json quiz) fence and show loading UI
  if (isStreaming) {
    const openQuizMatch = OPEN_QUIZ_FENCE_REGEX.exec(content);
    if (openQuizMatch) {
      return {
        beforeText: content.slice(0, openQuizMatch.index).trim(),
        afterText: "",
        quiz: null,
        isGeneratingQuiz: true,
      };
    }

    const openJsonMatch = /```json\s*\r?\n[\s\S]*"questions"\s*:[\s\S]*$/i.exec(content);
    if (openJsonMatch) {
      return {
        beforeText: content.slice(0, openJsonMatch.index).trim(),
        afterText: "",
        quiz: null,
        isGeneratingQuiz: true,
      };
    }
  }

  return {
    beforeText: content,
    afterText: "",
    quiz: null,
    isGeneratingQuiz: false,
  };
}
