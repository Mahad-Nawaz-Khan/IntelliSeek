import { describe, expect, it } from "vitest";

import { isQuizRequest, parseQuizFromContent } from "./quiz-parser";

describe("quiz-parser", () => {
  it("recognizes /quiz commands and explicit quiz requests", () => {
    expect(isQuizRequest("/quiz")).toBe(true);
    expect(isQuizRequest("/quiz @notes.pdf")).toBe(true);
    expect(isQuizRequest("Quiz me on binary heaps")).toBe(true);
    expect(isQuizRequest("Create an interactive multiple-choice quiz based on lecture.pdf")).toBe(true);

    expect(isQuizRequest("Explain AVL tree rotations")).toBe(false);
    expect(isQuizRequest("What does quiz mean in this context?")).toBe(false);
  });

  it("hides partial ```quiz JSON while streaming and returns generating state", () => {
    const partial = `Here is your practice quiz:\n\n\`\`\`quiz\n{"title":"Heaps Quiz","questions":[{"question":"What is`;
    const parsed = parseQuizFromContent(partial, true);

    expect(parsed.beforeText).toBe("Here is your practice quiz:");
    expect(parsed.afterText).toBe("");
    expect(parsed.quiz).toBeNull();
    expect(parsed.isGeneratingQuiz).toBe(true);
  });

  it("parses completed ```quiz blocks with trailing commas and clamps invalid indices", () => {
    const completed = `Ready to test yourself?\n\n\`\`\`quiz
{
  "title": "Binary Heaps",
  "questions": [
    {
      "question": "What is the time complexity of inserting into a binary heap?",
      "options": ["O(1)", "O(log n)", "O(n)", "O(n log n)",],
      "correctIndex": 1,
      "explanation": "Insertion bubbles up at most the height of the tree, which is O(log n).",
      "source": "heaps.pdf"
    },
    {
      "question": "Where is the minimum element stored in a min-heap?",
      "options": ["At the root", "At any leaf"],
      "correctIndex": 99,
      "explanation": ""
    },
  ],
}
\`\`\`\n\nGood luck!`;

    const parsed = parseQuizFromContent(completed, false);
    expect(parsed.isGeneratingQuiz).toBe(false);
    expect(parsed.beforeText).toBe("Ready to test yourself?");
    expect(parsed.afterText).toBe("Good luck!");
    expect(parsed.quiz).not.toBeNull();
    expect(parsed.quiz?.title).toBe("Binary Heaps");
    expect(parsed.quiz?.questions).toHaveLength(2);
    expect(parsed.quiz?.questions[0].correctIndex).toBe(1);
    expect(parsed.quiz?.questions[0].source).toBe("heaps.pdf");
    // Out-of-bounds index clamped safely to last option index
    expect(parsed.quiz?.questions[1].correctIndex).toBe(1);
    expect(parsed.quiz?.questions[1].explanation).toBeTruthy();
  });

  it("ignores normal ```json code blocks that are not quizzes", () => {
    const codeMsg = `Example payload:\n\n\`\`\`json\n{"name":"IntelliSeek","version":1}\n\`\`\``;
    const parsed = parseQuizFromContent(codeMsg, false);

    expect(parsed.quiz).toBeNull();
    expect(parsed.isGeneratingQuiz).toBe(false);
    expect(parsed.beforeText).toBe(codeMsg);
  });
});
