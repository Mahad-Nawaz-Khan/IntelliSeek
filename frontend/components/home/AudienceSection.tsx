"use client";

import { useState } from "react";
import { GraduationCap, Microscope, Code2, Users, CheckCircle2, ArrowRight, Sparkles } from "lucide-react";

const segments = [
  {
    id: "students",
    label: "Students & Learners",
    icon: GraduationCap,
    badge: "Undergraduate & Graduate",
    tagline: "Turn semester-long note sprawl into instant, exam-ready answers",
    hurdle:
      "Balancing 500-page textbooks, messy PPTX lecture decks, handwritten lab notes, and contradictory study guides before exam week.",
    solution:
      "IntelliSeek organizes all course documents into a single semantic index. Ask questions across your entire syllabus at once and receive immediate, source-grounded answers with exact slide and page citations.",
    capabilities: [
      "Dynamic cross-lecture queries with exact slide numbers",
      "Flashcard-ready synthesis and conceptual explanations",
      "Built-in OCR for phone-scanned PDF handouts and notes",
      "Zero-fluff summaries focused on exam requirements",
    ],
    sampleQuery: "Compare Dijkstra's and Bellman-Ford algorithms from my DSA slides and note when each fails.",
    sampleCitation: "DSA_Lecture08.pptx (Slide 14) & Textbook_Ch4.pdf (p. 112)",
  },
  {
    id: "researchers",
    label: "Scholars & Researchers",
    icon: Microscope,
    badge: "Faculty & Doctoral Labs",
    tagline: "Synthesize dense literature with uncompromising citation fidelity",
    hurdle:
      "Reviewing dozens of dense double-column arXiv and PubMed PDFs, tracking differing methodologies, and avoiding misattributed citations.",
    solution:
      "Traverse high-dimensional conceptual spaces across multiple papers simultaneously. Compare scientific results, extract mathematical equations, and verify author conclusions with one-click page previews.",
    capabilities: [
      "Cross-document comparative literature matrices",
      "Preservation of scientific tables and LaTeX formulas",
      "Granular attribution avoiding any hallucination drift",
      "High-speed discovery of subtle thematic connections",
    ],
    sampleQuery: "What are the empirical limitations noted for attention mechanisms in the 2024 vision papers?",
    sampleCitation: "VisionTransformers_Survey.pdf (p. 7) & arXiv_2403.0118.pdf (p. 12)",
  },
  {
    id: "engineers",
    label: "Engineers & Tech Teams",
    icon: Code2,
    badge: "Software & Systems",
    tagline: "Query internal RFCs, technical standards, and API manuals instantly",
    hurdle:
      "Navigating stale Notion wikis, multi-page architectural RFCs, and scattered SDK manuals during critical sprint deadlines.",
    solution:
      "Our hybrid Trie and vector engine indexes exact code symbols, configuration keys, and error codes alongside high-level system architectural principles.",
    capabilities: [
      "Exact symbol and parameter prefix lookups",
      "Instant contextual search across legacy and current RFCs",
      "Rapid onboarding for engineers joining complex codebases",
      "Cryptographically private local document sandboxing",
    ],
    sampleQuery: "What is the retry backoff strategy defined in our distributed payment service RFC?",
    sampleCitation: "RFC_402_PaymentPipeline.docx (Section 3.2) & Architecture_v2.pdf (p. 18)",
  },
  {
    id: "cohorts",
    label: "Study Cohorts & Labs",
    icon: Users,
    badge: "Teams & Academic Circles",
    tagline: "Unify collective intelligence in an authoritative, shared knowledge hub",
    hurdle:
      "Team members taking disjointed notes across different formats, leading to duplicate work and fragmented institutional memory.",
    solution:
      "Create shared team knowledge repositories with permission boundaries. Any cohort member can upload resources and query the collective knowledge base securely.",
    capabilities: [
      "Shared document repositories with role-based access",
      "Multi-contributor source grounding and provenance",
      "Elimination of repetitive questions in study group chats",
      "Centralized repository for lab meeting presentations",
    ],
    sampleQuery: "Summarize the consensus reached during our team's last three quarterly strategy decks.",
    sampleCitation: "Q2_Review.pptx (Slide 6) & Q3_Roadmap.pdf (p. 4)",
  },
];

export function AudienceSection() {
  const [activeTab, setActiveTab] = useState(0);
  const activeSegment = segments[activeTab];
  const Icon = activeSegment.icon;

  return (
    <section
      id="audience"
      aria-labelledby="audience-heading"
      className="relative mx-auto w-full max-w-7xl px-6 py-20 lg:px-10"
    >
      {/* Section Header */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-400/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-purple-300">
          <Sparkles className="h-3.5 w-3.5" />
          Tailored Workflows
        </div>
        <h2
          id="audience-heading"
          className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl"
        >
          Purpose-Built For How You Learn, Research, and Build
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">
          Different disciplines carry unique information challenges. Explore how IntelliSeek adapts to your specific cognitive demands.
        </p>
      </div>

      {/* Interactive Tabs */}
      <div className="mt-12 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {segments.map((segment, index) => {
          const TabIcon = segment.icon;
          const isActive = index === activeTab;
          return (
            <button
              key={segment.id}
              type="button"
              onClick={() => setActiveTab(index)}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-900/30 scale-105"
                  : "border border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/20 hover:bg-white/5"
              }`}
            >
              <TabIcon className="h-4 w-4" />
              <span>{segment.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Showcase Card */}
      <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 p-6 sm:p-10 shadow-2xl backdrop-blur-2xl">
        <div className="grid gap-10 lg:grid-cols-12 items-center">
          {/* Left Column: Context & Capabilities */}
          <div className="lg:col-span-7">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
                <Icon className="h-6 w-6" />
              </span>
              <div>
                <span className="rounded-full border border-purple-400/30 bg-purple-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-purple-200">
                  {activeSegment.badge}
                </span>
                <h3 className="mt-1 text-xl sm:text-2xl font-bold text-white">
                  {activeSegment.label}
                </h3>
              </div>
            </div>

            <p className="mt-4 text-base font-medium text-cyan-200">
              {activeSegment.tagline}
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                The Common Hurdle
              </p>
              <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
                {activeSegment.hurdle}
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                The IntelliSeek Solution
              </p>
              <p className="mt-1 text-xs sm:text-sm text-slate-200 leading-relaxed">
                {activeSegment.solution}
              </p>
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Key Workflow Capabilities
              </p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {activeSegment.capabilities.map((cap) => (
                  <div key={cap} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
                    <span>{cap}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Simulated Dialogue Demo */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                  Simulated Workspace Interaction
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 border border-emerald-400/20">
                  Live Preview
                </span>
              </div>

              {/* Prompt message */}
              <div className="mt-4 ml-auto max-w-[90%] rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3.5 text-xs text-cyan-100">
                <p className="font-semibold text-[11px] text-cyan-300 mb-1">Your Query</p>
                {activeSegment.sampleQuery}
              </div>

              {/* Response message */}
              <div className="mt-4 max-w-[95%] rounded-2xl border border-white/10 bg-white/5 p-3.5 text-xs text-slate-200 leading-relaxed">
                <p className="font-semibold text-[11px] text-purple-300 mb-1">IntelliSeek Synthesis</p>
                Dijkstra solves shortest paths on non-negative weighted graphs with greedy selection, while Bellman-Ford accommodates negative edge weights by relaxing all edges iteratively.

                <div className="mt-3 border-t border-white/10 pt-2.5">
                  <span className="text-[10px] text-slate-400 block mb-1">Grounded Lineage:</span>
                  <span className="inline-block rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[11px] font-medium text-cyan-200">
                    📄 {activeSegment.sampleCitation}
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/50 p-2.5 text-center text-xs text-slate-400">
                Ready to index your own files? Upload starts in seconds.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
