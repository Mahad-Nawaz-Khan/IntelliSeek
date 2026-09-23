import Link from "next/link";

export default function NotFound() {
  return (
    <main className="academic-page-shell flex min-h-screen items-center justify-center px-6 text-slate-100">
      <div className="max-w-md rounded-4xl border border-white/10 bg-white/5 p-10 text-center shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          The page you are looking for does not exist or may have moved.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-2xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          Back to IntelliSeek
        </Link>
      </div>
    </main>
  );
}
