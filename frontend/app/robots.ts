import type { MetadataRoute } from "next";

import { getSiteUrl } from "../lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // App pages sit behind authentication and have no indexable content.
        disallow: ["/api/", "/auth/", "/chat", "/chat/", "/library", "/settings", "/sign-in"],
      },
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
