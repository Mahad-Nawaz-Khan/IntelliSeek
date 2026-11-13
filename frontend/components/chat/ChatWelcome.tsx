import { UploadCloud } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "../ui/BrandMark";

type ChatWelcomeProps = {
  hasPersonalSources?: boolean;
  includeKnowledgeBase?: boolean;
  isDemo?: boolean;
  onOpenUpload?: () => void;
};

export function ChatWelcome({
  hasPersonalSources = false,
  includeKnowledgeBase = true,
  isDemo = false,
  onOpenUpload,
}: Readonly<ChatWelcomeProps>) {
  const description = isDemo
    ? "Ask a question about the sample course material. Answers include sources so you can check the details."
    : !includeKnowledgeBase
      ? hasPersonalSources
        ? "Knowledge Base is off — searching only your uploaded notes. Answers include sources so you can check the details."
        : "Knowledge Base is turned off. Upload your own notes to ground answers in your files, or re-enable Knowledge Base below."
      : hasPersonalSources
        ? "Ask a question about your notes. Answers include sources so you can check the details."
        : "Ask a question about the shared course material, or upload your own notes to get answers grounded in your files.";

  return (
    <section className="mx-auto my-0 flex w-full min-w-0 flex-col items-center px-0 py-0 text-center lg:max-w-4xl lg:px-4">
      <BrandMark size="lg" className="mb-5" />
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200">Study assistant</p>
      <h1 className="w-full max-w-full text-3xl font-semibold tracking-tight text-white md:text-4xl lg:max-w-3xl lg:text-5xl">
        What would you like to learn today?
      </h1>
      <p className="mt-4 w-full max-w-full text-sm leading-7 text-slate-400 md:text-base lg:max-w-2xl">
        {description}
      </p>

      {!isDemo && !hasPersonalSources && (
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {onOpenUpload ? (
            <button
              type="button"
              onClick={onOpenUpload}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
            >
              <UploadCloud className="h-4 w-4" />
              Upload your notes
            </button>
          ) : (
            <Link
              href="/sign-in?next=/chat"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
            >
              <UploadCloud className="h-4 w-4" />
              Sign in to upload notes
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
