This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

## Environment

Set these optional variables to make API rate limits global across Vercel serverless instances:

```bash
UPSTASH_REDIS_REST_URL="https://...upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."
```

When these variables are missing, the app falls back to an in-memory limiter. That
limiter is per-instance and forgotten on every cold start, so it is only a
best-effort bound — set the Upstash variables for any deployment where the limit
needs to actually hold.

```bash
# Proxies between the internet and this app. Defaults to 1, which is correct for
# Vercel and for Cloudflare in front of Vercel.
RATE_LIMIT_TRUSTED_PROXY_HOPS="1"
```

`x-forwarded-for` is appendable by the client, so the chain is read from the
right (the nearest proxy) rather than the left. Setting this too high lets a
caller forge its own rate-limit bucket; too low buckets every user behind your
own proxy together.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
