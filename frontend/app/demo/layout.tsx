import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SITE_DESCRIPTION, SITE_NAME } from "../../lib/site";

// The demo is part of the public funnel, so it stays indexable.
export const metadata: Metadata = {
  title: "Try the Demo",
  description: `Explore ${SITE_NAME} with a preloaded demo library — ask questions and see source-grounded answers without signing up. ${SITE_DESCRIPTION}`,
  alternates: {
    canonical: "/demo",
  },
};

export default function DemoLayout({ children }: { children: ReactNode }) {
  return children;
}
