"use client";

import { ArrowRight, BookOpen, FileText, Quote, Search, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useDemo } from "../../context/DemoContext";
import Image from "next/image";

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

// Rendered on the page and mirrored in FAQPage structured data (both must
// match for Google rich results).
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
    <main className="academic-page-shell min-h-screen overflow-hidden text-slate-100">
      <section className="mx-auto grid min-h-screen w-full max-w-7xl items-center gap-12 px-6 py-12 lg:grid-cols-[1fr_0.9fr] lg:px-10">
        <div>
          <div className="flex items-center gap-4 mb-4">
          <Image 
            src={"/TOP Logo.png"}
            height={100}
            width={100}
            alt="IntelliSeek"
            className="w-12 h-12 sm:w-20 sm:h-20 lg:w-24 lg:h-24 object-contain"
            />
            <div className="w-full text-2xl sm:text-4xl lg:text-5xl pt-3 font-semibold">
              <span className="text-slate-900 dark:text-white">Intelli</span>
              <span className="ml-1 bg-linear-to-br from-purple-600 to-cyan-600 bg-clip-text text-transparent dark:from-purple-600 dark:to-sky-500">Seek</span>
            </div>
          </div>
          
          <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
            Understand Your Notes With AI
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Semantic academic search powered by AI. Upload lecture notes, ask natural questions, and review source-grounded answers in one clean workspace.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/chat" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-cyan-950/30 transition hover:bg-cyan-200 hover:cursor-pointer">
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={handleTryDemo}
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
            >
              Try Demo
            </button>
          </div>
          <div className="mt-12 grid gap-3 sm:grid-cols-2">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="glow-border rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-950/20 backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/10">
                  <Icon className="mb-4 h-5 w-5 text-cyan-200" />
                  <h2 className="font-semibold text-white">{feature.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </div>

        <div className="landing-preview-card rounded-4xl border border-white/10 bg-slate-950/60 p-4 shadow-2xl shadow-slate-950/50 backdrop-blur-xl">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-200">IntelliSeek AI</p>
                <h2 className="mt-1 text-lg font-semibold text-white">Semantic Academic Assistant</h2>
              </div>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">Sources ready</span>
            </div>
            <div className="space-y-4">
              <div className="ml-auto max-w-[80%] rounded-3xl border border-cyan-300/20 bg-cyan-300/12 px-4 py-3 text-sm text-cyan-50">
                Explain dynamic programming from my DSA notes.
              </div>
              <div className="max-w-[88%] rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-200">
                Dynamic programming solves overlapping subproblems by storing results and reusing them instead of recomputing.
                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">DSA.pdf p12</span>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">Lecture3.pptx s4</span>
                </div>
              </div>
            </div>
            <div className="mt-5 rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-500">
              Ask anything about your notes...
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {['DSA.pdf', 'AI_Notes.pdf', 'Assignment.pdf'].map((source) => (
              <div key={source} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <FileText className="mb-2 h-4 w-4 text-cyan-200" />
                <p className="truncate text-xs font-medium text-slate-200">{source}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="faq-heading" className="mx-auto w-full max-w-7xl px-6 pb-20 lg:px-10">
        <h2 id="faq-heading" className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Frequently asked questions
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {faqItems.map((item) => (
            <article
              key={item.question}
              className="glow-border rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-950/20 backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              <h3 className="text-base font-semibold text-white">{item.question}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
    </main>
  );
}
