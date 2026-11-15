import { MessageCircleDashed, UploadCloud } from "lucide-react";
import Link from "next/link";

import {
  isSourcesResolved,
  shouldShowWelcomeUploadCta,
  type SourceStatus,
} from "../../lib/ui-state";
import { BrandMark } from "../ui/BrandMark";

type ChatWelcomeProps = {
  hasPersonalSources?: boolean;
  sourceStatus?: SourceStatus;
  includeKnowledgeBase?: boolean;
  isDemo?: boolean;
  isTemporaryChat?: boolean;
  onOpenUpload?: () => void;
};

type WelcomeDescriptionOptions = {
  isTemporaryChat: boolean;
  isDemo: boolean;
  includeKnowledgeBase: boolean;
  hasResolvedSources: boolean;
  hasPersonalSources: boolean;
};

function getWelcomeDescription({
  isTemporaryChat,
  isDemo,
  includeKnowledgeBase,
  hasResolvedSources,
  hasPersonalSources,
}: WelcomeDescriptionOptions): string {
  if (isTemporaryChat) {
    return "This conversation won't appear in your recent chats or be saved to your history.";
  }
  if (isDemo) {
    return "Ask a question about the sample course material. Answers include sources so you can check the details.";
  }
  if (!includeKnowledgeBase) {
    if (!hasResolvedSources) {
      return "Knowledge Base is off — checking your uploaded notes. Answers include sources so you can check the details.";
    }
    if (hasPersonalSources) {
      return "Knowledge Base is off — searching only your uploaded notes. Answers include sources so you can check the details.";
    }
    return "Knowledge Base is turned off. Upload your own notes to ground answers in your files, or re-enable Knowledge Base from the + menu.";
  }
  if (!hasResolvedSources) {
    return "Ask a question about your notes or shared course material. Answers include sources so you can check the details.";
  }
  if (hasPersonalSources) {
    return "Ask a question about your notes. Answers include sources so you can check the details.";
  }
  return "Ask a question about the shared course material, or upload your own notes to get answers grounded in your files.";
}

function WelcomeHeroIcon({ isTemporaryChat }: Readonly<{ isTemporaryChat: boolean }>) {
  if (isTemporaryChat) {
    return (
      <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-cyan-300/45 bg-cyan-400/12 text-cyan-200">
        <MessageCircleDashed className="h-6 w-6" />
      </span>
    );
  }
  return <BrandMark size="lg" className="mb-5" />;
}

function WelcomeUploadAction({ onOpenUpload }: Readonly<{ onOpenUpload?: () => void }>) {
  if (onOpenUpload) {
    return (
      <button
        type="button"
        onClick={onOpenUpload}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
      >
        <UploadCloud className="h-4 w-4" />
        Upload your notes
      </button>
    );
  }
  return (
    <Link
      href="/sign-in?next=/chat"
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
    >
      <UploadCloud className="h-4 w-4" />
      Sign in to upload notes
    </Link>
  );
}

export function ChatWelcome({
  hasPersonalSources = false,
  sourceStatus = "loading",
  includeKnowledgeBase = true,
  isDemo = false,
  isTemporaryChat = false,
  onOpenUpload,
}: Readonly<ChatWelcomeProps>) {
  const hasResolvedSources = isSourcesResolved(sourceStatus);
  const shouldShowUploadButton = shouldShowWelcomeUploadCta({
    sourceStatus,
    hasPersonalSources,
    isDemo,
    isTemporaryChat,
  });

  const description = getWelcomeDescription({
    isTemporaryChat,
    isDemo,
    includeKnowledgeBase,
    hasResolvedSources,
    hasPersonalSources,
  });

  const subtitle = isTemporaryChat ? "Temporary chat" : "Study assistant";
  const heading = isTemporaryChat ? "Temporary Chat" : "What would you like to learn today?";

  return (
    <section
      key={isTemporaryChat ? "temp" : "standard"}
      className="chat-enter mx-auto my-0 flex w-full min-w-0 flex-col items-center px-0 py-0 text-center lg:max-w-4xl lg:px-4"
    >
      <WelcomeHeroIcon isTemporaryChat={isTemporaryChat} />
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200">
        {subtitle}
      </p>
      <h1 className="w-full max-w-full text-3xl font-semibold tracking-tight text-white md:text-4xl lg:max-w-3xl lg:text-5xl">
        {heading}
      </h1>
      <p className="mt-4 w-full max-w-full text-sm leading-7 text-slate-400 md:text-base lg:max-w-2xl">
        {description}
      </p>

      {shouldShowUploadButton && (
        <div className="chat-fade-in mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <WelcomeUploadAction onOpenUpload={onOpenUpload} />
        </div>
      )}
    </section>
  );
}
