"use client";

import {
  ArrowLeft,
  Eye,
  EyeOff,
  GraduationCap,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

import { useTheme } from "../../context/ThemeContext";
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
  const { theme, toggleTheme } = useTheme();
  const next = getSafeReturnPath(searchParams.get("next"));
  const callbackError = getErrorMessage(searchParams.get("error"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<
    "google" | "github" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const isDark = theme === "dark";

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

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace(getSafeReturnPath(next));
  }

  return (
    <main className="auth-page relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.18),transparent_34%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-size-[56px_56px] opacity-30" />

      <button
        type="button"
        onClick={toggleTheme}
        className="absolute right-6 top-6 z-50 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:border-cyan-300/30 hover:bg-white/10 hover:cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        title={isDark ? "Switch to light theme" : "Switch to dark theme"}
        suppressHydrationWarning
      >
        {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-6 sm:px-6 lg:px-10">
        <div className="grid w-full gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="auth-card order-2 rounded-4xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:p-8 lg:order-1 lg:min-h-170">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white hover:cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>

            <h1 className="mt-6 max-w-xl text-4xl font-semibold tracking-[-0.06em] text-white md:text-5xl">
              Continue learning from your own notes.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              Sign in to upload course material, index sources, and ask
              IntelliSeek questions with citations tied to your account.
            </p>
            <div className="mt-10 grid gap-3">
              {[
                "Private source library scoped to your account.",
                "Google and GitHub login powered by Supabase Auth.",
                "RAG answers only retrieve chunks from your uploaded documents.",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="auth-card order-1 rounded-4xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur-2xl sm:p-8 lg:order-2">
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <Image
                  src={"/TOP Logo.png"}
                  height={80}
                  width={80}
                  alt="IntelliSeek"
                  className="w-10 h-10 sm:w-16 sm:h-16 lg:w-20 lg:h-20 object-contain"
                />
                <h1 className="w-full text-lg sm:text-2xl lg:text-4xl pt-3 font-semibold">
                  <span className="text-slate-900 dark:text-white">
                    Intelli
                  </span>
                  <span className="ml-1 bg-linear-to-br from-purple-600 to-cyan-600 bg-clip-text text-transparent dark:from-purple-600 dark:to-sky-500">
                    Seek
                  </span>
                </h1>
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tighter text-white">
                Welcome back
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Use Google, GitHub, or your email account.
              </p>
            </div>

            {error || callbackError ? (
              <div className="mb-5 rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                {error ?? callbackError}
              </div>
            ) : null}

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleProvider("google")}
                disabled={Boolean(oauthProvider)}
                  className="flex w-full items-center justify-center gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-cyan-300/30 hover:bg-white/10 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Image
                  src="/icons/google.svg"
                  alt=""
                  width={20}
                  height={20}
                  aria-hidden="true"
                />
                {oauthProvider === "google"
                  ? "Redirecting..."
                  : "Continue with Google"}
              </button>
              <button
                type="button"
                onClick={() => handleProvider("github")}
                disabled={Boolean(oauthProvider)}
                className="flex w-full items-center justify-center gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-cyan-300/30 hover:bg-white/10 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Image
                  src={isDark ? "/icons/github.svg" : "/icons/github-black.svg"}
                  alt=""
                  width={20}
                  height={20}
                  aria-hidden="true"
                />
                {oauthProvider === "github"
                  ? "Redirecting..."
                  : "Continue with GitHub"}
              </button>
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                or use email
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-hidden transition placeholder:text-slate-500 focus:border-cyan-300/50"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Password
                </label>
                <div className="flex items-center rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 transition focus-within:border-cyan-300/50">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-transparent text-sm text-white outline-hidden placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="text-slate-500 transition hover:text-white hover:cursor-pointer"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-[22px] bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in with email"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-400">
              Need an account?{" "}
              <Link href="/sign-up" className="text-cyan-200 underline hover:cursor-pointer">
                Create one
              </Link>
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
