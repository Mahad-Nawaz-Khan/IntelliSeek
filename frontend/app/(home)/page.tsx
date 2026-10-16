"use client";

import { ArrowRight, BookOpen, CheckCircle2, FileText, Quote, Search, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { useDemo } from "../../context/DemoContext";
import { HomeNavbar } from "../../components/home/HomeNavbar";
import { NorthStarSection } from "../../components/home/NorthStarSection";
import { UspSection } from "../../components/home/UspSection";
import { ObjectivesSection } from "../../components/home/ObjectivesSection";
import { StrategyBlueprintSection } from "../../components/home/StrategyBlueprintSection";
import { AudienceSection } from "../../components/home/AudienceSection";
import { StrategicMatrixSection } from "../../components/home/StrategicMatrixSection";
import { HomeFooter } from "../../components/home/HomeFooter";

const features = [
  {
    title: "Semantic Search",
    description: "Find concepts across notes by meaning, not just exact keywords.",
    icon: Search,
  },
  {
    title: "Multi-Format Uploads",
    description: "Prepare PDFs, DOCX files, PPTX slides, and TXT notes for academic Q&A.",
    icon: UploadCloud,
  },
  {
    title: "AI Explanations",
    description: "Turn dense course material into clear answers, examples, and study guidance.",
    icon: BookOpen,
  },
  {
    title: "Source Citations",
    description: "Keep answers grounded with compact source chips and preview context.",
    icon: Quote,
  },
];

const faqItems = [
  {
    question: "What is IntelliSeek?",
    answer:
      "IntelliSeek is an AI study workspace for students. Upload your lecture notes, slides, and PDFs, then ask questions and get answers grounded in your own material with citations to the exact source.",
  },
  {
    question: "Which file types can I upload?",
    answer:
      "You can upload PDF, DOCX, PPTX, TXT, and Markdown files up to 20 MB. Scanned image-only PDFs work too — built-in OCR reads them before indexing.",
  },
  {
    question: "How are answers grounded in my documents?",
    answer:
      "Every upload is split into chunks, embedded, and indexed semantically. When you ask a question, IntelliSeek retrieves the most relevant chunks and cites the exact file they came from.",
  },
  {
    question: "Is IntelliSeek free?",
    answer:
      "Yes. You can create an account, upload your notes, and ask questions for free. A demo is also available without signing in.",
  },
  {
    question: "Do my documents stay private?",
    answer:
      "Your uploads are indexed into your personal library and only retrievable by your account. Admins can additionally publish material to a shared knowledge base for everyone.",
  },
];

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export default function Home() {
  const router = useRouter();
  const { startDemo } = useDemo();

  function handleTryDemo() {
    startDemo();
    router.push("/demo");
  }

  return (
    <div className="academic-page-shell min-h-screen text-slate-100 flex flex-col justify-between">
      {/* Top Navigation */}
      <HomeNavbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-300 mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              Academic Retrieval & Synthesis Platform
            </div>

            <div className="flex items-center gap-4 mb-4">
              <Image
                src="/TOP Logo.png"
                height={80}
                width={80}
                alt="IntelliSeek"
                className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 object-contain"
                priority
              />
              <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
                <span className="brand-wordmark-primary">Intelli</span>
                <span className="ml-1 bg-gradient-to-r from-purple-500 to-cyan-400 bg-clip-text text-transparent">
                  Seek
                </span>
              </div>
            </div>

            <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.1]">
              Understand Your Notes With AI
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Semantic academic search powered by AI. Upload lecture notes, ask natural questions, and review source-grounded answers in one clean workspace.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-400 px-6 py-3.5 text-sm font-semibold text-slate-950 shadow-xl shadow-cyan-950/30 transition hover:from-cyan-300 hover:to-sky-300 hover:cursor-pointer"
              >
                Create a free account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={handleTryDemo}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10 hover:border-white/20"
              >
                Try Demo
              </button>
            </div>

            {/* Quick Trust Badges */}
            <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                100% Page & Slide Citations
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-purple-400" />
                Zero Model Training On Your Files
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                OCR For Scanned Handouts
              </span>
            </div>

            {/* 4 Feature Mini Cards */}
            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <article
                    key={feature.title}
                    className="glow-border rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-slate-950/20 backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/10"
                  >
                    <Icon className="mb-3 h-5 w-5 text-cyan-300" />
                    <h2 className="text-sm font-semibold text-white">{feature.title}</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{feature.description}</p>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Interactive Preview Simulator */}
          <div className="landing-preview-card rounded-4xl border border-white/10 bg-slate-950/70 p-4 sm:p-6 shadow-2xl shadow-slate-950/50 backdrop-blur-xl">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-cyan-300 font-semibold">
                    IntelliSeek AI
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-white">
                    Semantic Academic Assistant
                  </h2>
                </div>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  Sources ready
                </span>
              </div>
              <div className="space-y-4">
                <div className="ml-auto max-w-[85%] rounded-3xl border border-cyan-300/20 bg-cyan-300/15 px-4 py-3 text-xs sm:text-sm text-cyan-50">
                  Explain dynamic programming from my DSA notes and show the trade-off.
                </div>
                <div className="max-w-[90%] rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-xs sm:text-sm leading-6 text-slate-200">
                  Dynamic programming solves overlapping subproblems by caching intermediate results rather than recomputing them, exchanging polynomial memory for exponential time savings.
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-medium text-cyan-100">
                      📄 DSA.pdf p12
                    </span>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-medium text-cyan-100">
                      📊 Lecture3.pptx s4
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs sm:text-sm text-slate-500">
                Ask anything about your notes, slides, or textbook PDFs...
              </div>
            </div>
            <div className="mt-4 grid gap-3 grid-cols-3">
              {["DSA.pdf", "AI_Notes.pdf", "Assignment.pdf"].map((source) => (
                <div key={source} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <FileText className="mb-2 h-4 w-4 text-cyan-300" />
                  <p className="truncate text-xs font-medium text-slate-200">{source}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 1. USP (Unique Selling Proposition) Section */}
        <UspSection />

        {/* 2. Vision & Mission Section (Foundational Horizons) */}
        <NorthStarSection />

        {/* 3. Strategies Section (The Engineering Blueprint) */}
        <StrategyBlueprintSection />

        {/* 4. Objectives Section (Measurable Commitments & Benchmarks) */}
        <ObjectivesSection />

        {/* 5. Segmentation Analysis Section (Tailored Workflows For Every Learner) */}
        <AudienceSection />

        {/* 6. SWOT Analysis Section (Operational Matrix: Capabilities, Frontiers & Defenses) */}
        <StrategicMatrixSection />

        {/* FAQ Section */}
        <section
          id="faq"
          aria-labelledby="faq-heading"
          className="mx-auto w-full max-w-7xl px-6 py-20 lg:px-10"
        >
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" />
              Frequently Asked Questions
            </div>
            <h2
              id="faq-heading"
              className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
            >
              Everything You Need to Know
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">
              Common questions about file formats, citation integrity, and document security.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {faqItems.map((item) => (
              <article
                key={item.question}
                className="glow-border rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-slate-900/80"
              >
                <h3 className="text-base font-bold text-white">{item.question}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        {/* High-Impact Pre-Footer Call to Action */}
        <section className="relative mx-auto w-full max-w-7xl px-6 pb-24 lg:px-10">
          <div className="homepage-cta-card overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-r from-slate-900/90 via-purple-950/40 to-slate-900/90 p-8 sm:p-14 text-center shadow-2xl backdrop-blur-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" />
              Instant Academic Leverage
            </span>
            <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Ready to make studying your notes easier?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-slate-300">
              Upload your lecture slides, PDFs, and notes, then ask questions and check each answer against its cited source.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-400 px-7 py-3.5 text-sm font-semibold text-slate-950 shadow-xl shadow-cyan-950/40 transition hover:from-cyan-300 hover:to-sky-300"
              >
                Create a free account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={handleTryDemo}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10 hover:border-white/20"
              >
                Explore Interactive Demo
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Modern SaaS Footer */}
      <HomeFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
    </div>
  );
}
