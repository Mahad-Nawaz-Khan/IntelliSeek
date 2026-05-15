import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type GlassCardProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function GlassCard<T extends ElementType = "div">({
  as,
  children,
  className = "",
  ...props
}: GlassCardProps<T>) {
  const Component = as ?? "div";

  return (
    <Component
      className={`rounded-3xl border border-white/10 bg-white/[0.06] shadow-2xl shadow-slate-950/30 backdrop-blur-xl ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
