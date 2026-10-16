import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, ShieldCheck, Lock, Sparkles, CheckCircle2 } from "lucide-react";

export function HomeFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Brand & Manifesto Column */}
          <div className="lg:col-span-4">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/TOP Logo.png"
                width={40}
                height={40}
                alt="IntelliSeek"
                className="h-10 w-10 object-contain"
              />
              <div className="text-2xl font-bold tracking-tight">
                <span className="text-slate-900 dark:text-white">Intelli</span>
                <span className="ml-0.5 bg-gradient-to-r from-purple-500 to-cyan-400 bg-clip-text text-transparent">
                  Seek
                </span>
              </div>
            </Link>

            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              The high-precision academic workspace. Upload course notes, research publications, and slides to ask natural questions backed by verifiable, page-level citations.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Systems Operational
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                <Lock className="h-3 w-3 text-cyan-400" />
                Zero Model Training
              </span>
            </div>
          </div>

          {/* Navigation Columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8">
            {/* Column 1: Platform & Architecture */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                Architecture
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <a href="#advantage" className="text-slate-400 transition hover:text-white">
                    The Advantage
                  </a>
                </li>
                <li>
                  <a href="#north-star" className="text-slate-400 transition hover:text-white">
                    Foundational Horizons
                  </a>
                </li>
                <li>
                  <a href="#blueprint" className="text-slate-400 transition hover:text-white">
                    Engineering Blueprint
                  </a>
                </li>
                <li>
                  <a href="#benchmarks" className="text-slate-400 transition hover:text-white">
                    Performance Benchmarks
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 2: Workflows & Audience */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-purple-300">
                Workflows
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <a href="#audience" className="text-slate-400 transition hover:text-white">
                    For Undergrads & Graduates
                  </a>
                </li>
                <li>
                  <a href="#audience" className="text-slate-400 transition hover:text-white">
                    For Doctoral Scholars
                  </a>
                </li>
                <li>
                  <a href="#audience" className="text-slate-400 transition hover:text-white">
                    For Engineering Teams
                  </a>
                </li>
                <li>
                  <a href="#matrix" className="text-slate-400 transition hover:text-white">
                    Strategic Matrix
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Access & Workspaces */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Get Started
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link href="/chat" className="text-slate-400 transition hover:text-white">
                    Launch Workspace
                  </Link>
                </li>
                <li>
                  <Link href="/demo" className="text-slate-400 transition hover:text-white">
                    Interactive Demo
                  </Link>
                </li>
                <li>
                  <Link href="/sign-in" className="text-slate-400 transition hover:text-white">
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link href="/sign-up" className="text-slate-400 transition hover:text-white">
                    Create Account
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} IntelliSeek. Engineered with mathematical rigor for curious minds.</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
              Cryptographic Tenant Isolation
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              100% Citation Grounding
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
