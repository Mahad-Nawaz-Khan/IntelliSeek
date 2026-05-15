import type { ReactNode } from "react";

type StatusBadgeProps = {
  children: ReactNode;
  tone?: "cyan" | "violet" | "emerald" | "amber" | "slate" | "red";
  className?: string;
};

const tones = {
  cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
  violet: "border-violet-300/20 bg-violet-400/10 text-violet-100",
  emerald: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
  amber: "border-amber-300/20 bg-amber-400/10 text-amber-100",
  slate: "border-white/10 bg-white/8 text-slate-300",
  red: "border-red-300/20 bg-red-400/10 text-red-100",
};

export function StatusBadge({ children, tone = "slate", className = "" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
