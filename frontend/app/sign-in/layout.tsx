import type { Metadata } from "next";
import type { ReactNode } from "react";

// Auth screens have no search value and should not appear in results.
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function SignInLayout({ children }: { children: ReactNode }) {
  return children;
}
