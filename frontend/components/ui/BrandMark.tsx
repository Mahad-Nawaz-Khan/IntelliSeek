import { Sparkles } from "lucide-react";

type BrandMarkProps = {
  /** `lg` is the welcome-screen hero; `sm` is the per-message avatar. */
  size?: "sm" | "lg";
  /**
   * Rotates the mark. Used while an answer is streaming, in place of a separate
   * spinner and a "thinking" label.
   */
  spinning?: boolean;
  className?: string;
};

const SIZES = {
  sm: { frame: "h-8 w-8 rounded-xl", icon: "h-4 w-4" },
  lg: { frame: "h-14 w-14 rounded-[1.25rem]", icon: "h-7 w-7" },
} as const;

/**
 * The IntelliSeek mark, shared by the welcome screen and the assistant message
 * avatar so the assistant is recognisably the same thing the user was greeted by.
 *
 * The rotation is wrapped in `motion-safe:` so it respects
 * `prefers-reduced-motion`.
 */
export function BrandMark({ size = "sm", spinning = false, className = "" }: Readonly<BrandMarkProps>) {
  const { frame, icon } = SIZES[size];

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center border border-cyan-300/20 bg-cyan-300/10 text-cyan-200 ${frame} ${
        size === "lg" ? "shadow-2xl shadow-cyan-950/30" : ""
      } ${className}`}
    >
      <Sparkles className={`${icon} ${spinning ? "motion-safe:animate-spin" : ""}`} />
    </span>
  );
}
