import { Zap, RefreshCw, TrendingUp, ShieldCheck, CheckCircle2, ArrowUpRight, Sparkles, Layers } from "lucide-react";

const matrixQuadrants = [
  {
    type: "superpowers",
    kicker: "Core Superpowers",
    title: "Where Our Architecture Leads",
    subtitle: "High-performance capabilities driving daily precision",
    icon: Zap,
    accent: "text-cyan-300",
    badgeBg: "bg-cyan-500/10 text-cyan-300 border-cyan-400/20",
    borderHover: "hover:border-cyan-400/40",
    items: [
      {
        title: "Sub-Second Hybrid Retrieval",
        desc: "Fuses Trie prefix indexing with dense HNSW vector search, delivering microsecond keyword lookup and sub-200ms semantic similarity.",
      },
      {
        title: "Native Layout-Aware OCR",
        desc: "Built-in optical character recognition parses phone-scanned PDF notes, double-column academic papers, and PPTX slide decks without external tools.",
      },
      {
        title: "Deterministic Source Attribution",
        desc: "Strict lineage enforcement guarantees every assertion is backed by clickable page numbers, slide indices, and document chunk references.",
      },
      {
        title: "Sovereign Sandbox Isolation",
        desc: "Tenant files remain encrypted and strictly isolated—never shared across accounts or used to train third-party foundation models.",
      },
    ],
  },
  {
    type: "frontiers",
    kicker: "Active Engineering Frontiers",
    title: "What We're Actively Advancing",
    subtitle: "R&D initiatives currently in continuous deployment",
    icon: RefreshCw,
    accent: "text-purple-300",
    badgeBg: "bg-purple-500/10 text-purple-300 border-purple-400/20",
    borderHover: "hover:border-purple-400/40",
    items: [
      {
        title: "Expanded File Volume Limits",
        desc: "Engineering distributed chunk-streaming to lift single-file upload limits beyond 20MB for 1,000+ page medical and legal anthologies.",
      },
      {
        title: "Native Lecture Audio & Video Indexing",
        desc: "Developing automated acoustic-to-semantic pipelines to index recorded professor lectures and laboratory demonstrations directly.",
      },
      {
        title: "Multilingual Vector Alignment",
        desc: "Refining cross-lingual embedding models so queries in one language accurately retrieve conceptual answers from foreign-language sources.",
      },
      {
        title: "Air-Gapped Local Inference",
        desc: "Architecting lightweight quantized local models for researchers working in confidential medical laboratories without internet access.",
      },
    ],
  },
  {
    type: "horizons",
    kicker: "Emerging Horizons",
    title: "The Future We're Unlocking",
    subtitle: "Expanding possibilities across academic ecosystems",
    icon: TrendingUp,
    accent: "text-emerald-300",
    badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-400/20",
    borderHover: "hover:border-emerald-400/40",
    items: [
      {
        title: "Direct LMS Sync (Canvas, Blackboard, Moodle)",
        desc: "One-click synchronization to automatically ingest syllabus updates, assignment rubrics, and professor announcements as they are posted.",
      },
      {
        title: "Synthetic Exam & Flashcard Generator",
        desc: "Intelligent extraction of key principles from uploaded course packs into automated spaced-repetition quizzes and mock exams.",
      },
      {
        title: "Collaborative Cohort Vaults",
        desc: "Secure study circles where peers share verified document repositories with granular permission boundaries and joint annotation layers.",
      },
      {
        title: "Curriculum Gap Diagnostics",
        desc: "Predictive analysis comparing your course notes against standard university syllabi to flag missing topics before finals week.",
      },
    ],
  },
  {
    type: "safeguards",
    kicker: "Proactive Defenses",
    title: "How We Safeguard Your Trust",
    subtitle: "Architectural resilience against industry challenges",
    icon: ShieldCheck,
    accent: "text-amber-300",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-400/20",
    borderHover: "hover:border-amber-400/40",
    items: [
      {
        title: "Mitigating AI Hallucination Drift",
        desc: "Defended by hard chunk relevance scoring and rejection thresholds. If a concept is not in your notes, IntelliSeek explicitly alerts you.",
      },
      {
        title: "Defending Intellectual Property & Privacy",
        desc: "Zero document pooling or commercial scraping. Documents are stored with AES-256 encryption at rest and guarded by tenant keys.",
      },
      {
        title: "Protecting Against API Provider Volatility",
        desc: "Multi-provider LLM routing with fallback failovers ensures round-the-clock uptime during critical final exam periods.",
      },
      {
        title: "Preserving Authentic Academic Integrity",
        desc: "We promote deep learning over shortcut generation by centering answers around verifiable primary source citations.",
      },
    ],
  },
];

export function StrategicMatrixSection() {
  return (
    <section
      id="matrix"
      aria-labelledby="matrix-heading"
      className="relative mx-auto w-full max-w-7xl px-6 py-20 lg:px-10"
    >
      {/* Section Header */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-300">
          <Sparkles className="h-3.5 w-3.5" />
          Strategic Transparency
        </div>
        <h2
          id="matrix-heading"
          className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
        >
          Our Operational Matrix: Capabilities, Frontiers & Safeguards
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">
          An honest, unvarnished appraisal of where our architecture leads, the engineering frontiers we are actively expanding, and how we safeguard your academic journey.
        </p>
      </div>

      {/* 4 Quadrants Grid */}
      <div className="mt-14 grid gap-8 md:grid-cols-2">
        {matrixQuadrants.map((quadrant) => {
          const Icon = quadrant.icon;
          return (
            <div
              key={quadrant.title}
              className={`glow-border group relative flex flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/60 p-7 sm:p-8 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 ${quadrant.borderHover}`}
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                      <Icon className={`h-5 w-5 ${quadrant.accent}`} />
                    </span>
                    <div>
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${quadrant.badgeBg}`}>
                        {quadrant.kicker}
                      </span>
                      <h3 className="mt-1 text-lg sm:text-xl font-bold text-white">
                        {quadrant.title}
                      </h3>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-xs font-medium text-slate-400">
                  {quadrant.subtitle}
                </p>

                {/* Quadrant Items */}
                <div className="mt-6 space-y-4">
                  {quadrant.items.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-white/5 bg-white/[0.02] p-3.5 transition group-hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className={`h-4 w-4 shrink-0 ${quadrant.accent}`} />
                        <h4 className="text-sm font-semibold text-white">
                          {item.title}
                        </h4>
                      </div>
                      <p className="mt-1.5 pl-6 text-xs leading-relaxed text-slate-300">
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status footer pill */}
              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-[11px] text-slate-400">
                <span>Transparent Engineering Standard</span>
                <span className={`font-semibold ${quadrant.accent}`}>Operational Continuity</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
