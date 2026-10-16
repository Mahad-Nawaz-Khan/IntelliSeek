"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useDemo } from "../../context/DemoContext";
import { useRouter } from "next/navigation";

const navLinks = [
  { name: "The Advantage", href: "#advantage" },
  { name: "North Star", href: "#north-star" },
  { name: "Blueprint", href: "#blueprint" },
  { name: "Benchmarks", href: "#benchmarks" },
  { name: "Who It's For", href: "#audience" },
  { name: "Matrix", href: "#matrix" },
  { name: "FAQ", href: "#faq" },
];

export function HomeNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { startDemo } = useDemo();
  const router = useRouter();

  function handleTryDemo() {
    startDemo();
    router.push("/demo");
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/70 backdrop-blur-xl transition-colors duration-200">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative flex items-center justify-center">
            <Image
              src="/TOP Logo.png"
              width={36}
              height={36}
              alt="IntelliSeek Logo"
              className="h-9 w-9 object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <div className="text-xl font-bold tracking-tight">
            <span className="text-slate-900 dark:text-white">Intelli</span>
            <span className="ml-0.5 bg-gradient-to-r from-purple-500 to-cyan-400 bg-clip-text text-transparent">
              Seek
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-1 xl:gap-2 md:flex">
          {navLinks.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              {item.name}
            </a>
          ))}
        </nav>

        {/* Action Controls */}
        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle visual theme"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4 text-cyan-500" />
            ) : (
              <Sun className="h-4 w-4 text-amber-300" />
            )}
          </button>

          <button
            type="button"
            onClick={handleTryDemo}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
          >
            Try Demo
          </button>

          <Link
            href="/sign-up"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:from-cyan-300 hover:to-sky-300"
          >
            <span>Create Account</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Mobile controls */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle visual theme"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="border-b border-white/10 bg-slate-950/95 px-6 py-4 backdrop-blur-2xl md:hidden">
          <nav className="flex flex-col gap-2">
            {navLinks.map((item) => (
              <a
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
              >
                {item.name}
              </a>
            ))}
            <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleTryDemo();
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-center text-sm font-semibold text-slate-200"
              >
                Try Demo
              </button>
              <Link
                href="/sign-up"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 py-2.5 text-center text-sm font-semibold text-slate-950"
              >
                Create a free account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
