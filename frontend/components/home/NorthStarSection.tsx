import { Compass, Target, Sparkles, CheckCircle2, ShieldCheck, Globe, BookOpen } from "lucide-react";

export function NorthStarSection() {
  return (
    <section
      id="north-star"
      aria-labelledby="north-star-heading"
      className="relative mx-auto w-full max-w-7xl px-6 py-20 lg:px-10"
    >
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute -top-12 left-1/2 -z-10 h-96 w-full -translate-x-1/2 opacity-30 blur-3xl">
        <div className="mx-auto h-full w-3/4 rounded-full bg-gradient-to-r from-purple-600/30 via-cyan-500/20 to-sky-400/30" />
      </div>

      {/* Section Header */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-purple-300">
          <Sparkles className="h-3.5 w-3.5" />
          Foundational Horizons
        </div>
        <h2
          id="north-star-heading"
          className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
        >
          Guided By Vision. Anchored in Truth.
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">
          We are dismantling the barrier between vast document collections and instant human understanding—replacing fragmented note searches with fluid, verifiable intelligence.
        </p>
      </div>

      {/* Dual Narrative Grid: Vision & Mission */}
      <div className="mt-14 grid gap-8 lg:grid-cols-2">
        {/* Card 1: Our North Star (Vision) */}
        <article className="glow-border group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-purple-950/20 backdrop-blur-xl transition hover:-translate-y-1 hover:border-purple-400/30 hover:bg-slate-900/80">
          <div className="absolute -right-16 -top-16 -z-10 h-48 w-48 rounded-full bg-purple-600/15 blur-2xl transition group-hover:bg-purple-600/25" />

          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-400/10 text-purple-300">
                  <Compass className="h-6 w-6" />
                </span>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-purple-300">
                    The North Star
                  </span>
                  <p className="text-sm font-medium text-slate-400">Our Aspirational Future</p>
                </div>
              </div>
              <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-3 py-1 text-xs font-medium text-purple-200">
                Future-Forward
              </span>
            </div>

            <h3 className="mt-6 text-2xl font-bold text-white">
              A World Where Any Complex Idea Is Instantly Synthesized
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
              We envision an educational and research ecosystem where no curious mind is ever slowed down by disorganized archives, dense multi-volume anthologies, or buried course notes. Knowledge becomes an active collaborator—effortlessly synthesizing complex concepts across multiple disciplines and semesters in seconds.
            </p>

            <ul className="mt-6 space-y-3">
              <li className="flex items-start gap-3 text-sm text-slate-300">
                <Globe className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
                <span><strong className="text-white">Fluid Cross-Disciplinary Synthesis:</strong> Connect insights across disparate lecture courses, research papers, and technical standards.</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-300">
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
                <span><strong className="text-white">Active Cognitive Assistance:</strong> Moving from passive reading to dynamic, Socratic dialogue grounded in your material.</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-300">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
                <span><strong className="text-white">Democratizing Academic Mastery:</strong> Giving every student and scholar the research leverage of a dedicated faculty team.</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 text-xs text-purple-200">
            <span className="font-semibold text-purple-100">Our Core Promise:</span> Deep conceptual mastery without the hours lost searching for the right page.
          </div>
        </article>

        {/* Card 2: Our Daily Commitment (Mission) */}
        <article className="glow-border group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl transition hover:-translate-y-1 hover:border-cyan-400/30 hover:bg-slate-900/80">
          <div className="absolute -right-16 -top-16 -z-10 h-48 w-48 rounded-full bg-cyan-500/15 blur-2xl transition group-hover:bg-cyan-500/25" />

          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
                  <Target className="h-6 w-6" />
                </span>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-cyan-300">
                    Our Daily Commitment
                  </span>
                  <p className="text-sm font-medium text-slate-400">Our Practical Mandate</p>
                </div>
              </div>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                Active Execution
              </span>
            </div>

            <h3 className="mt-6 text-2xl font-bold text-white">
              Grounding Machine Intelligence in Verifiable Human Truth
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
              Our everyday mandate is precise: engineer state-of-the-art hybrid retrieval architectures that tether generative models directly to verified source texts. We eliminate hallucination drift by demanding that every claim be accompanied by exact page numbers, slide coordinates, and previewable citations.
            </p>

            <ul className="mt-6 space-y-3">
              <li className="flex items-start gap-3 text-sm text-slate-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                <span><strong className="text-white">100% Traceable Lineage:</strong> Every answer links directly to the underlying document chunk, page, or slide.</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-300">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                <span><strong className="text-white">Strict Tenant Isolation:</strong> Documents stay within your private workspace—never used to train public language models.</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-300">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                <span><strong className="text-white">Sub-Second Vector Querying:</strong> Real-time responses powered by graph-based ANN indexing (HNSW) and trie search.</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-xs text-cyan-200">
            <span className="font-semibold text-cyan-100">Our Standard:</span> If an assertion cannot be cited with mathematical certainty, we do not generate it.
          </div>
        </article>
      </div>
    </section>
  );
}
