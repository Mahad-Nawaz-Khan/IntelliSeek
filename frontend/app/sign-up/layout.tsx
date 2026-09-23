import type { Metadata } from "next";
import type { ReactNode } from "react";

// Auth screens have no search value and should not appear in results.
export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};

export default function SignUpLayout({ children }: { children: ReactNode }) {
  return children;
}
