"use client";

import { ArrowLeft, Eye, EyeOff, GraduationCap, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

import { getSafeReturnPath } from "../../lib/safe-redirect";
import { hasSupabasePublicConfig, supabase } from "../../lib/supabase";

function getErrorMessage(error: string | null) {
  switch (error) {
    case "auth_callback_failed":
      return "Sign-in could not be completed. Please try again.";
    default:
      return null;
  }
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = getSafeReturnPath(searchParams.get("next"));
  const callbackError = getErrorMessage(searchParams.get("error"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<"google" | "github" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace(getSafeReturnPath(next));
    });
  }, [next, router]);

  async function handleProvider(provider: "google" | "github") {
    setError(null);
    setOauthProvider(provider);

    if (!supabase || !hasSupabasePublicConfig()) {
      setError("Supabase Auth is not configured.");
      setOauthProvider(null);
      return;
    }

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(getSafeReturnPath(next))}`;
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setOauthProvider(null);
      return;
    }

    if (data.url) {
      window.location.assign(data.url);
      return;
    }

    setError("Could not start OAuth sign-in.");
    setOauthProvider(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    if (!supabase || !hasSupabasePublicConfig()) {
      setError("Supabase Auth is not configured.");
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace(getSafeReturnPath(next));
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.18),transparent_34%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px] opacity-30" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-6 sm:px-6 lg:px-10">
        <div className="grid w-full gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="order-2 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:p-8 lg:order-1 lg:min-h-[680px]">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" /> Academic workspace
            </div>
            <h1 className="mt-6 max-w-xl text-4xl font-semibold tracking-[-0.06em] text-white md:text-5xl">
              Continue learning from your own notes.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              Sign in to upload course material, index sources, and ask IntelliSeek questions with citations tied to your account.
            </p>
            <div className="mt-10 grid gap-3">
              {["Private source library scoped to your account.", "Google and GitHub login powered by Supabase Auth.", "RAG answers only retrieve chunks from your uploaded documents."].map((item) => (
                <div key={item} className="rounded-3xl border border-white/10 bg-white/[0.05] px-4 py-4 text-sm text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="order-1 rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur-2xl sm:p-8 lg:order-2">
            <div className="mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950">
                <GraduationCap className="h-6 w-6" />
              </div>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-100/70">IntelliSeek</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">Welcome back</h2>
              <p className="mt-2 text-sm text-slate-400">Use Google, GitHub, or your email account.</p>
            </div>

            {error || callbackError ? (
              <div className="mb-5 rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error ?? callbackError}</div>
            ) : null}

            <div className="space-y-3">
              <button type="button" onClick={() => handleProvider("google")} disabled={Boolean(oauthProvider)} className="flex w-full items-center justify-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:border-cyan-300/30 hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-60">
                <Image src="/icons/google.svg" alt="" width={20} height={20} aria-hidden="true" />
                {oauthProvider === "google" ? "Redirecting..." : "Continue with Google"}
              </button>
              <button type="button" onClick={() => handleProvider("github")} disabled={Boolean(oauthProvider)} className="flex w-full items-center justify-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:border-cyan-300/30 hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-60">
                <Image src="/icons/github.svg" alt="" width={20} height={20} aria-hidden="true" />
                {oauthProvider === "github" ? "Redirecting..." : "Continue with GitHub"}
              </button>
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[11px] uppercase tracking-[0.28em] text-slate-500">or use email</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-300">Email</label>
                <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50" />
              </div>
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-300">Password</label>
                <div className="flex items-center rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-3 transition focus-within:border-cyan-300/50">
                  <input id="password" type={showPassword ? "text" : "password"} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="text-slate-500 transition hover:text-white" aria-label="Toggle password visibility">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center rounded-[22px] bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? "Signing in..." : "Sign in with email"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-400">
              Need an account? <Link href="/sign-up" className="text-cyan-200 underline">Create one</Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
