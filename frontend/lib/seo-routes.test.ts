import { describe, expect, it } from "vitest";

import robots from "../app/robots";
import sitemap from "../app/sitemap";

describe("robots.txt generator", () => {
  it("allows crawling, blocks app + api routes, and links the sitemap", () => {
    const result = robots();
    expect(result.rules).toEqual([
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", "/chat", "/chat/", "/library", "/settings", "/sign-in"],
      },
    ]);
    expect(result.sitemap).toBe("https://intelliseek-ai.vercel.app/sitemap.xml");
  });
});

describe("sitemap generator", () => {
  it("lists the public pages with absolute URLs", () => {
    const result = sitemap();
    expect(result.map((entry) => entry.url)).toEqual([
      "https://intelliseek-ai.vercel.app/",
      "https://intelliseek-ai.vercel.app/demo",
      "https://intelliseek-ai.vercel.app/sign-up",
    ]);
    expect(result.every((entry) => entry.lastModified instanceof Date)).toBe(true);
  });
});
