import { Gauge, CheckCircle, ShieldAlert, Award, ArrowUpRight, Activity } from "lucide-react";

const benchmarks = [
  {
    metric: "< 180ms",
    unit: "Latency",
    label: "Vector Retrieval Response",
    description:
      "Hierarchical Navigable Small World (HNSW) graphs query high-dimensional embeddings in logarithmic time, returning semantic matches almost instantaneously.",
    status: "Consistently Met",
    benchmarkTarget: "Target: < 200ms",
    accent: "text-cyan-300",
    borderGlow: "group-hover:border-cyan-400/40",
    bgBadge: "bg-cyan-500/10 text-cyan-300 border-cyan-400/20",
    progressPercent: 92,
  },
  {
    metric: "100%",
    unit: "Provenance",
    label: "Grounded Source Lineage",
    description:
      "Every generated assertion is tied to verified document chunks. We do not extrapolate without evidence; answers feature clickable page and slide anchors.",
    status: "Mathematically Enforced",
    benchmarkTarget: "Target: 100% Attribution",
    accent: "text-emerald-300",
    borderGlow: "group-hover:border-emerald-400/40",
    bgBadge: "bg-emerald-500/10 text-emerald-300 border-emerald-400/20",
    progressPercent: 100,
  },
  {
    metric: "99.4%",
    unit: "Fidelity",
    label: "Multi-Format Parsing & OCR",
    description:
      "Layout-aware ingestion handles multi-column research papers, PPTX slide decks, and scanned PDF handouts with high optical and structural accuracy.",
    status: "Industry Leading",
    benchmarkTarget: "Target: > 99.0%",
    accent: "text-purple-300",
    borderGlow: "group-hover:border-purple-400/40",
    bgBadge: "bg-purple-500/10 text-purple-300 border-purple-400/20",
    progressPercent: 99,
  },
  {
    metric: "0%",
    unit: "Leakage",
    label: "Document Privacy Sovereignty",
    description:
      "Zero user document pooling or third-party LLM training. Each study workspace is an isolated encrypted sandbox respecting academic and institutional privacy.",
    status: "Cryptographically Bound",
    benchmarkTarget: "Target: 0% Data Exposure",
    accent: "text-sky-300",
    borderGlow: "group-hover:border-sky-400/40",
    bgBadge: "bg-sky-500/10 text-sky-300 border-sky-400/20",
    progressPercent: 100,
  },
];

export function ObjectivesSection() {
  return (
    <section
      id="benchmarks"
      aria-labelledby="benchmarks-heading"
      className="relative mx-auto w-full max-w-7xl px-6 py-20 lg:px-10"
    >
      {/* Section Header */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
          <Activity className="h-3.5 w-3.5" />
          Measurable Commitments
        </div>
        <h2
          id="benchmarks-heading"
          className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
        >
          Engineering Benchmarks We Hold Ourselves Accountable To
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">
          We believe quality must be quantified. Every release of IntelliSeek is tested against stringent speed, accuracy, and data security thresholds.
        </p>
      </div>

      {/* Benchmarks Grid */}
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {benchmarks.map((item) => (
          <div
            key={item.label}
            className={`glow-border group relative flex flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 ${item.borderGlow}`}
          >
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {item.unit}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${item.bgBadge}`}
                >
                  {item.status}
                </span>
              </div>

              <div className="mt-5 flex items-baseline gap-2">
                <span className={`text-4xl font-extrabold tracking-tight sm:text-5xl ${item.accent}`}>
                  {item.metric}
                </span>
              </div>

              <h3 className="mt-3 text-base font-bold text-white">
                {item.label}
              </h3>

              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                {item.description}
              </p>
            </div>

            <div className="mt-6 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>{item.benchmarkTarget}</span>
                <span className="text-emerald-400 font-medium">100% Compliant</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
                  style={{ width: `${item.progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
