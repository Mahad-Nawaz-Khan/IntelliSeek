import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "tesseract.js"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/tesseract.js/**/*"],
  },
};

export default nextConfig;
