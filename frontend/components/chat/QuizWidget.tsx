"use client";

import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  FileText,
  HelpCircle,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { QuizPayload } from "../../lib/quiz-parser";

export function QuizLoadingCard() {
  return (
    <div
      className="chat-quiz-card chat-enter my-3 overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950/75 p-4 shadow-lg shadow-cyan-950/20"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-300">
          <Sparkles className="h-4 w-4 animate-pulse" />
        </span>
        <div>
          <p className="text-xs font-semibold text-cyan-100">Building your interactive quiz...</p>
          <p className="text-[0.7rem] text-slate-400">Preparing questions from your context</p>
        </div>
      </div>
      <div className="mt-4 space-y-2.5">
        <div className="h-4 w-4/5 animate-pulse rounded-lg bg-white/10" />
        <div className="mt-3 space-y-2">
          {[0, 1, 2, 3].map((slot) => (
            <div
              key={slot}
              className="h-10 w-full animate-pulse rounded-xl border border-white/5 bg-white/[0.04]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type QuizWidgetProps = {
  quiz: QuizPayload;
  onRequestNewQuiz?: (prompt: string) => void;
};

function getMasteryMessage(percentage: number): string {
  if (percentage >= 80) return "Strong mastery of this material.";
  if (percentage >= 50) return "Good progress — review the highlighted misses below.";
  return "Keep practicing — revisit any missed concepts below.";
}

function getSummaryBadgeClass(isCorrect: boolean, isWrong: boolean): string {
  if (isCorrect) return "bg-emerald-400/15 text-emerald-300";
  if (isWrong) return "bg-red-400/15 text-red-300";
  return "bg-white/10 text-slate-400";
}

function SummaryStatusIcon({ isCorrect, isWrong }: Readonly<{ isCorrect: boolean; isWrong: boolean }>) {
  if (isCorrect) return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (isWrong) return <XCircle className="h-4 w-4 text-red-400" />;
  return <HelpCircle className="h-4 w-4 text-slate-500" />;
}

type StoredQuizProgress = {
  currentIndex: number;
  selectedAnswers: Record<number, number>;
  showSummary: boolean;
};

const QUIZ_PROGRESS_PREFIX = "intelliseek-quiz-progress:";

/** Stable key derived from quiz content so progress survives remounts and chat switches. */
function getQuizStorageKey(quiz: QuizPayload): string {
  const source = JSON.stringify([
    quiz.title,
    quiz.questions.map((question) => [question.question, question.options, question.correctIndex]),
  ]);
  let hash = 5381;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) + hash + source.charCodeAt(index)) | 0;
  }
  return `${QUIZ_PROGRESS_PREFIX}${(hash >>> 0).toString(36)}`;
}

function readQuizProgress(key: string, total: number): StoredQuizProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredQuizProgress>;
    const selectedAnswers: Record<number, number> = {};
    if (parsed.selectedAnswers && typeof parsed.selectedAnswers === "object") {
      Object.entries(parsed.selectedAnswers).forEach(([questionIndex, optionIndex]) => {
        const qIndex = Number(questionIndex);
        if (Number.isInteger(qIndex) && qIndex >= 0 && qIndex < total && Number.isInteger(optionIndex)) {
          selectedAnswers[qIndex] = optionIndex as number;
        }
      });
    }
    const currentIndex = Number.isInteger(parsed.currentIndex) ? (parsed.currentIndex as number) : 0;
    return { currentIndex, selectedAnswers, showSummary: parsed.showSummary === true };
  } catch {
    return null;
  }
}

function writeQuizProgress(key: string, progress: StoredQuizProgress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(progress));
  } catch {
    // Storage may be full or unavailable (private mode); progress simply won't persist.
  }
}

export function QuizWidget({ quiz, onRequestNewQuiz }: Readonly<QuizWidgetProps>) {
  const storageKey = useMemo(() => getQuizStorageKey(quiz), [quiz]);
  const [initialProgress] = useState(() => readQuizProgress(storageKey, quiz.questions.length));
  const [currentIndex, setCurrentIndex] = useState(initialProgress?.currentIndex ?? 0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>(
    initialProgress?.selectedAnswers ?? {},
  );
  const [showSummary, setShowSummary] = useState(initialProgress?.showSummary ?? false);

  useEffect(() => {
    writeQuizProgress(storageKey, { currentIndex, selectedAnswers, showSummary });
  }, [currentIndex, selectedAnswers, showSummary, storageKey]);

  const total = quiz.questions.length;
  const boundedIndex = Math.max(0, Math.min(currentIndex, total - 1));
  const currentQuestion = quiz.questions[boundedIndex];
  const selectedOption = selectedAnswers[boundedIndex];
  const hasAnsweredCurrent = selectedOption !== undefined;

  const { answeredCount, correctCount, percentage } = useMemo(() => {
    let answered = 0;
    let correct = 0;
    quiz.questions.forEach((question, index) => {
      const choice = selectedAnswers[index];
      if (choice !== undefined) {
        answered += 1;
        if (choice === question.correctIndex) correct += 1;
      }
    });
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { answeredCount: answered, correctCount: correct, percentage: pct };
  }, [quiz.questions, selectedAnswers, total]);

  const handleSelectOption = (optionIndex: number) => {
    if (hasAnsweredCurrent) return;
    setSelectedAnswers((current) => ({
      ...current,
      [boundedIndex]: optionIndex,
    }));
  };

  const handleRetry = () => {
    setSelectedAnswers({});
    setCurrentIndex(0);
    setShowSummary(false);
  };

  const handleJumpToQuestion = (index: number) => {
    setCurrentIndex(index);
    setShowSummary(false);
  };

  if (showSummary) {
    const masteryMessage = getMasteryMessage(percentage);

    return (
      <section
        className="chat-quiz-card chat-enter my-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/75 shadow-xl shadow-slate-950/30"
        aria-label={`Quiz results: ${quiz.title}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-300">
              <Award className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-white">{quiz.title}</h3>
              <p className="text-[0.7rem] text-slate-400">Quiz completed</p>
            </div>
          </div>
          <div className="rounded-full border border-cyan-300/30 bg-cyan-400/15 px-3 py-1 text-xs font-semibold text-cyan-100">
            {correctCount} / {total} ({percentage}%)
          </div>
        </div>

        <div className="p-4">
          <p className="text-sm text-slate-200">{masteryMessage}</p>
          {answeredCount < total && (
            <p className="mt-1 text-xs text-amber-300">
              You answered {answeredCount} of {total} questions. Click any question below to complete or review it.
            </p>
          )}

          <div className="mt-4 space-y-2">
            {quiz.questions.map((question, index) => {
              const choice = selectedAnswers[index];
              const isCorrect = choice !== undefined && choice === question.correctIndex;
              const isWrong = choice !== undefined && choice !== question.correctIndex;
              const badgeClass = getSummaryBadgeClass(isCorrect, isWrong);

              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => handleJumpToQuestion(index)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-cyan-300/35 hover:bg-white/[0.06]"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${badgeClass}`}
                    >
                      {index + 1}
                    </span>
                    <span className="truncate text-xs font-medium text-slate-200 sm:text-sm">
                      {question.question}
                    </span>
                  </div>
                  <span className="shrink-0">
                    <SummaryStatusIcon isCorrect={isCorrect} isWrong={isWrong} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-white/[0.02] px-4 py-3">
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-cyan-300/30 hover:bg-white/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry Quiz
          </button>

          {onRequestNewQuiz && (
            <button
              type="button"
              onClick={() =>
                onRequestNewQuiz(
                  `/quiz Generate 4 new multiple-choice questions on ${quiz.title} covering different concepts.`,
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400/20 px-3 py-1.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-300/35 transition hover:bg-cyan-400/30"
            >
              <Sparkles className="h-3.5 w-3.5" />
              New Quiz
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      className="chat-quiz-card chat-enter my-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/75 shadow-xl shadow-slate-950/30"
      aria-label={`Interactive quiz: ${quiz.title}`}
    >
      {/* Top Progress & Question Step Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
              {quiz.title}
            </span>
          </div>
          <p className="mt-0.5 text-[0.7rem] text-slate-400">
            Question {boundedIndex + 1} of {total}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Quiz questions">
          {quiz.questions.map((question, index) => {
            const choice = selectedAnswers[index];
            const isCurrent = index === boundedIndex;
            const isCorrect = choice !== undefined && choice === question.correctIndex;
            const isWrong = choice !== undefined && choice !== question.correctIndex;

            let pillClass = "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200";
            if (isCurrent) {
              pillClass = "border-cyan-300 bg-cyan-400/20 text-cyan-100 ring-1 ring-cyan-300/30";
            } else if (isCorrect) {
              pillClass = "border-emerald-400/45 bg-emerald-400/15 text-emerald-200";
            } else if (isWrong) {
              pillClass = "border-red-400/45 bg-red-400/15 text-red-200";
            }

            return (
              <button
                key={question.id}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                onClick={() => setCurrentIndex(index)}
                className={`flex h-7 min-w-7 items-center justify-center rounded-lg border px-1.5 text-xs font-semibold transition ${pillClass}`}
                aria-label={`Go to question ${index + 1}`}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Question Prompt */}
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-medium leading-6 text-white sm:text-base">
            {currentQuestion.question}
          </p>
          {currentQuestion.source && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.68rem] text-slate-300">
              <FileText className="h-3 w-3 text-cyan-300" />
              <span className="max-w-44 truncate">{currentQuestion.source}</span>
            </span>
          )}
        </div>

        {/* Antigravity-style Choice Options */}
        <fieldset className="m-0 mt-3.5 space-y-2 border-0 p-0">
          <legend className="sr-only">{currentQuestion.question}</legend>
          {currentQuestion.options.map((option, optionIndex) => {
            const letter = String.fromCharCode(65 + optionIndex);
            const isSelected = selectedOption === optionIndex;
            const isCorrectOption = optionIndex === currentQuestion.correctIndex;

            let optionContainerClass =
              "border-white/10 bg-white/[0.03] text-slate-100 hover:border-cyan-300/40 hover:bg-cyan-400/10";
            let letterBadgeClass = "border-white/15 bg-white/5 text-slate-300";

            if (hasAnsweredCurrent) {
              if (isCorrectOption) {
                optionContainerClass = "border-emerald-400/55 bg-emerald-500/15 text-emerald-50";
                letterBadgeClass = "border-emerald-400 bg-emerald-400 text-slate-950";
              } else if (isSelected) {
                optionContainerClass = "border-red-400/55 bg-red-500/15 text-red-100";
                letterBadgeClass = "border-red-400 bg-red-400 text-slate-950";
              } else {
                optionContainerClass = "border-white/5 bg-white/[0.02] text-slate-400 opacity-60";
                letterBadgeClass = "border-white/10 bg-white/5 text-slate-500";
              }
            }

            return (
              <label
                key={`${currentQuestion.id}-opt-${letter}`}
                className={`relative flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cyan-300 ${
                  hasAnsweredCurrent ? "cursor-default" : "cursor-pointer"
                } ${optionContainerClass}`}
              >
                <input
                  type="radio"
                  name={`quiz-question-${currentQuestion.id}`}
                  value={optionIndex}
                  checked={isSelected}
                  disabled={hasAnsweredCurrent}
                  onChange={() => handleSelectOption(optionIndex)}
                  className="sr-only"
                />
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition ${letterBadgeClass}`}
                >
                  {letter}
                </span>
                <span className="min-w-0 flex-1 leading-5">{option}</span>
                {hasAnsweredCurrent && isCorrectOption && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="hidden sm:inline">{isSelected ? "Correct" : "Answer"}</span>
                  </span>
                )}
                {hasAnsweredCurrent && isSelected && !isCorrectOption && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-red-300">
                    <XCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Your choice</span>
                  </span>
                )}
              </label>
            );
          })}
        </fieldset>

        {/* Instant Explanation Callout */}
        {hasAnsweredCurrent && (
          <div
            className={`chat-enter mt-3.5 rounded-xl border px-3.5 py-2.5 text-xs leading-5 ${
              selectedOption === currentQuestion.correctIndex
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                : "border-amber-300/30 bg-amber-500/10 text-amber-100"
            }`}
          >
            <p className="font-semibold">
              {selectedOption === currentQuestion.correctIndex ? "Correct!" : "Not quite — here is why:"}
            </p>
            <p className="mt-1 text-slate-200">{currentQuestion.explanation}</p>
          </div>
        )}
      </div>

      {/* Stepper Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-white/[0.02] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={boundedIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Previous
          </button>
          <span className="text-xs text-slate-400">
            Score:{" "}
            <span className="font-semibold text-slate-200">
              {correctCount}/{answeredCount}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {answeredCount === total && boundedIndex < total - 1 && (
            <button
              type="button"
              onClick={() => setShowSummary(true)}
              className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-400/20"
            >
              Results
            </button>
          )}
          {boundedIndex < total - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
              className="inline-flex items-center gap-1 rounded-xl bg-cyan-400/20 px-3 py-1.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-300/35 transition hover:bg-cyan-400/30"
            >
              Next
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowSummary(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400/20 px-3 py-1.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-300/35 transition hover:bg-cyan-400/30"
            >
              <Award className="h-3.5 w-3.5" />
              View Results
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
