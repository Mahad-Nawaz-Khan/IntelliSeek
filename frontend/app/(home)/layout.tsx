import type { Metadata } from "next";

import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "../../lib/site";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  title: SITE_TAGLINE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: "/",
    type: "website",
    siteName: SITE_NAME,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `${SITE_NAME} — ${SITE_TAGLINE}` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: SITE_NAME,
      url: getSiteUrl(),
      description: SITE_DESCRIPTION,
      inLanguage: "en",
    },
    {
      "@type": "WebApplication",
      name: SITE_NAME,
      url: getSiteUrl(),
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      description: SITE_DESCRIPTION,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "Semantic search across uploaded notes, slides, and PDFs",
        "AI answers grounded in your own documents with citations",
        "OCR indexing for scanned PDFs",
        "Document library with personal and shared knowledge bases",
      ],
      creator: {
        "@type": "Organization",
        name: SITE_NAME,
        url: getSiteUrl(),
      },
    },
  ],
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {children}
    </>
  );
}
