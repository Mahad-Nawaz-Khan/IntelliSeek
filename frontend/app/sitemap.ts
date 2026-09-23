import type { MetadataRoute } from "next";

import { getSiteUrl } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();

  return [
    { url: `${siteUrl}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/demo`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/sign-up`, lastModified, changeFrequency: "yearly", priority: 0.5 },
  ];
}
