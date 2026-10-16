import { Check, X, Shield, Cpu, FileCheck, Search, Sparkles, Layers } from "lucide-react";

const differentiators = [
  {
    icon: FileCheck,
    title: "Zero-Fabrication Grounding",
    tagline: "Proven citations, not plausible guesses",
    description:
      "Standard chatbots synthesize answers from generic internet memory. IntelliSeek anchors every single statement in your actual documents, providing clickable chips that highlight the exact page, paragraph, or slide number.",
    badge: "100% Traceable",
    accent: "from-cyan-500/20 to-blue-500/20",
    border: "border-cyan-400/20",
    textAccent: "text-cyan-300",
  },
  {
    icon: Search,
    title: "Dual-Signal Hybrid Retrieval",
    tagline: "Lexical precision meets semantic depth",
    description:
      "Vector search alone misses exact variable names, mathematical notation, and medical acronyms. We fuse prefix Trie lookups with dense HNSW vector embeddings to retrieve both literal terms and high-level conceptual ideas simultaneously.",
    badge: "Hybrid Engine",
    accent: "from-purple-500/20 to-pink-500/20",
    border: "border-purple-400/20",
    textAccent: "text-purple-300",
  },
  {
    icon: Cpu,
    title: "Universal OCR & Academic Parsing",
    tagline: "From messy scanned PDFs to vector embeddings",
    description:
      "Course packs, scanned lecture handouts, complex double-column research articles, and slide decks are processed through automated OCR and layout-aware chunking—so no piece of curriculum is left unsearchable.",
    badge: "OCR Built-In",
    accent: "from-sky-500/20 to-teal-500/20",
    border: "border-sky-400/20",
    textAccent: "text-sky-300",
  },
  {
    icon: Shield,
    title: "Sovereign Academic Privacy",
    tagline: "Your research stays strictly yours",
    description:
      "Your uploaded papers, notes, and study guides are stored in isolated encrypted tenant enclaves. We enforce an uncompromising zero-training policy—your intellectual property is never fed to train foundation models.",
    badge: "Zero-Training",
    accent: "from-emerald-500/20 to-cyan-500/20",
    border: "border-emerald-400/20",
    textAccent: "text-emerald-300",
  },
];

const comparisonRows = [
  {
    feature: "Source Citation & Traceability",
    generic: "Vague summaries or made-up URLs",
    intelliseek: "Exact file, page number, and slide coordinates",
  },
  {
    feature: "Scanned Handouts & Image-Only PDFs",
    generic: "Fails or requires manual transcriptions",
    intelliseek: "Automatic optical character recognition (OCR)",
  },
  {
    feature: "Exact Terminology & Code Lookup",
    generic: "Suffers from semantic drift on niche terms",
    intelliseek: "Hybrid Trie prefix lookup + vector similarity",
  },
  {
    feature: "Document Security & Privacy",
    generic: "Often used to train future AI generations",
    intelliseek: "Isolated tenant enclaves, zero model training",
  },
  {
    feature: "Multi-Document Synthesis",
    generic: "Context window spills and forgets prior files",
    intelliseek: "Persistent semantic vector indexing across collections",
  },
];

export function UspSection() {
  return (
    <section
      id="advantage"
      aria-labelledby="advantage-heading"
      className="relative mx-auto w-full max-w-7xl px-6 py-20 lg:px-10"
    >
      {/* Section Header */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-300">
          <Sparkles className="h-3.5 w-3.5" />
          The IntelliSeek Distinction
        </div>
        <h2
          id="advantage-heading"
          className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
        >
          Why Discerning Minds Choose IntelliSeek Over Generic AI
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">
          Generic chat engines guess when asked about your proprietary notes. IntelliSeek was purpose-built from the ground up for mathematical retrieval guarantees and verifiable provenance.
        </p>
      </div>

      {/* 4 Core Differentiators Grid */}
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {differentiators.map((diff) => {
          const Icon = diff.icon;
          return (
            <div
              key={diff.title}
              className={`glow-border group relative flex flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:border-white/20`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${diff.border} bg-white/5 ${diff.textAccent}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                    {diff.badge}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white group-hover:text-cyan-200 transition-colors">
                  {diff.title}
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-400">{diff.tagline}</p>
                <p className="mt-3 text-xs leading-relaxed text-slate-300">
                  {diff.description}
                </p>
              </div>

              <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                <span>Active Capability</span>
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Direct Comparison Matrix */}
      <div className="mt-16 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 shadow-2xl backdrop-blur-xl">
        <div className="border-b border-white/10 bg-white/[0.02] px-6 py-5 sm:px-8">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                Architectural Breakdown
              </p>
              <h3 className="text-lg font-bold text-white sm:text-xl">
                Generic AI Chatbots vs. IntelliSeek
              </h3>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
              Verified Superiority
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th scope="col" className="px-6 py-4 sm:px-8">Key Capability</th>
                <th scope="col" className="px-6 py-4 text-slate-400">Generic AI Assistants</th>
                <th scope="col" className="px-6 py-4 text-cyan-300">IntelliSeek Platform</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {comparisonRows.map((row) => (
                <tr key={row.feature} className="transition hover:bg-white/[0.02]">
                  <td className="px-6 py-4 font-medium text-white sm:px-8">
                    {row.feature}
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 shrink-0 text-rose-400" />
                      <span>{row.generic}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-cyan-100">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-cyan-400" />
                      <span>{row.intelliseek}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
