import { FileText, Cpu, Network, CheckCircle2, ArrowRight } from "lucide-react";

const strategySteps = [
  {
    step: "01",
    title: "Adaptive Parsing & OCR",
    subtitle: "Universal Document Ingestion",
    description:
      "Raw files (PDFs, PPTX, DOCX, TXT) undergo deep layout inspection. Scanned pages trigger automated OCR pipelines, extracting text, code snippets, and mathematical formulas while preserving document hierarchy.",
    icon: FileText,
    accent: "from-cyan-500/20 to-sky-500/20",
    border: "border-cyan-400/30",
    badge: "Stage 1",
  },
  {
    step: "02",
    title: "Dual-Signal Indexing",
    subtitle: "Lexical Trie & Vector Fusion",
    description:
      "Chunks are simultaneously embedded into high-dimensional semantic vector spaces and compiled into prefix Trie structures, allowing instant matching for exact terminology, code symbols, and abstract concepts alike.",
    icon: Cpu,
    accent: "from-purple-500/20 to-indigo-500/20",
    border: "border-purple-400/30",
    badge: "Stage 2",
  },
  {
    step: "03",
    title: "Graph-Accelerated Search",
    subtitle: "HNSW Approximate Nearest Neighbors",
    description:
      "Candidate retrieval traverses Hierarchical Navigable Small World (HNSW) vector graphs in sub-linear time, filtering tens of thousands of document chunks in milliseconds with minimal computational overhead.",
    icon: Network,
    accent: "from-sky-500/20 to-blue-500/20",
    border: "border-sky-400/30",
    badge: "Stage 3",
  },
  {
    step: "04",
    title: "Constrained Synthesis",
    subtitle: "Verified Lineage & Citation Anchors",
    description:
      "Generative models are fed strictly filtered context with zero-tolerance prompt boundaries. The synthesized output arrives with clickable page chips, preserving absolute provenance and academic integrity.",
    icon: CheckCircle2,
    accent: "from-emerald-500/20 to-cyan-500/20",
    border: "border-emerald-400/30",
    badge: "Stage 4",
  },
];

export function StrategyBlueprintSection() {
  return (
    <section
      id="blueprint"
      aria-labelledby="blueprint-heading"
      className="relative mx-auto w-full max-w-7xl px-6 py-20 lg:px-10"
    >
      {/* Section Header */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300">
          <Network className="h-3.5 w-3.5" />
          The Engineering Blueprint
        </div>
        <h2
          id="blueprint-heading"
          className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
        >
          How We Deliver Precision: The Four-Pillar Pipeline
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">
          A disciplined, multi-stage retrieval architecture converting messy academic notes into instantaneous, verified answers.
        </p>
      </div>

      {/* 4 Pipeline Pillars */}
      <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {strategySteps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className={`glow-border group relative flex flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:border-white/20`}
            >
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="text-2xl font-black text-slate-500 group-hover:text-cyan-400 transition-colors">
                    {step.step}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                    {step.badge}
                  </span>
                </div>

                <div className="mt-5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-cyan-300">
                  <Icon className="h-5 w-5" />
                </div>

                <h3 className="mt-4 text-lg font-bold text-white group-hover:text-cyan-200 transition-colors">
                  {step.title}
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-400">{step.subtitle}</p>

                <p className="mt-3 text-xs leading-relaxed text-slate-300">
                  {step.description}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-slate-400">
                <span>Phase {idx + 1} of 4</span>
                <span className="text-cyan-300 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                  Automated Pipeline <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
