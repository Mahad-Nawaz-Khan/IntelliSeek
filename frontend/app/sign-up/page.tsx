"use client";

import { ArrowLeft, Eye, EyeOff, GraduationCap, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { getSafeReturnPath } from "../../lib/safe-redirect";
import { hasSupabasePublicConfig, supabase } from "../../lib/supabase";

export default function SignUpPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<"google" | "github" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [next] = useState(() => {
    if (typeof window === "undefined") return "/chat";
    return getSafeReturnPath(new URLSearchParams(window.location.search).get("next"));
  });

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

    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
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

    setError("Could not start OAuth sign-up.");
    setOauthProvider(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!supabase || !hasSupabasePublicConfig()) {
      setError("Supabase Auth is not configured.");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        data: {
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          full_name: [firstName, lastName].map((part) => part.trim()).filter(Boolean).join(" ") || null,
        },
      },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      router.replace(getSafeReturnPath(next));
      return;
    }

    setNotice("Check your email to confirm your account, then return to sign in.");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.18),transparent_34%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px] opacity-30" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-6 sm:px-6 lg:px-10">
        <div className="grid w-full gap-5 lg:grid-cols-[1fr_1fr]">
          <section className="order-2 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:p-8 lg:order-1 lg:min-h-[720px]">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-100">
              <Sparkles className="h-3.5 w-3.5" /> Create account
            </div>
            <h1 className="mt-6 max-w-xl text-4xl font-semibold tracking-[-0.06em] text-white md:text-5xl">
              Turn your notes into a semantic study assistant.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              Create an IntelliSeek account to keep your uploads, indexed chunks, chat history, and citations tied to your own source library.
            </p>
            <div className="mt-10 grid gap-3">
              {["Upload PDF, DOCX, PPTX, and TXT notes into your account.", "Retrieve only your own chunks with cosine Top-K search.", "Ask academic questions and get source-grounded answers."].map((item) => (
                <div key={item} className="rounded-3xl border border-white/10 bg-white/[0.05] px-4 py-4 text-sm text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="order-1 rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur-2xl sm:p-8 lg:order-2">
            <div className="mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-300 text-slate-950">
                <GraduationCap className="h-6 w-6" />
              </div>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.3em] text-violet-100/70">IntelliSeek</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">Create your account</h2>
              <p className="mt-2 text-sm text-slate-400">Use a provider or sign up with email.</p>
            </div>

            {error ? (
              <div className="mb-5 rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div>
            ) : null}
            {notice ? (
              <div className="mb-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</div>
            ) : null}

            <div className="space-y-3">
              <button type="button" onClick={() => handleProvider("google")} disabled={Boolean(oauthProvider)} className="flex w-full items-center justify-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:border-cyan-300/30 hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-60">
                <Image src="/icons/google.svg" alt="" width={20} height={20} aria-hidden="true" />
                {oauthProvider === "google" ? "Redirecting..." : "Sign up with Google"}
              </button>
              <button type="button" onClick={() => handleProvider("github")} disabled={Boolean(oauthProvider)} className="flex w-full items-center justify-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:border-cyan-300/30 hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-60">
                <Image src="/icons/github.svg" alt="" width={20} height={20} aria-hidden="true" />
                {oauthProvider === "github" ? "Redirecting..." : "Sign up with GitHub"}
              </button>
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[11px] uppercase tracking-[0.28em] text-slate-500">or sign up with email</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="mb-2 block text-sm font-medium text-slate-300">First name</label>
                  <input id="firstName" type="text" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="First" className="w-full rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50" />
                </div>
                <div>
                  <label htmlFor="lastName" className="mb-2 block text-sm font-medium text-slate-300">Last name</label>
                  <input id="lastName" type="text" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Last" className="w-full rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50" />
                </div>
              </div>
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-300">Email</label>
                <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50" />
              </div>
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-300">Password</label>
                <div className="flex items-center rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-3 transition focus-within:border-cyan-300/50">
                  <input id="password" type={showPassword ? "text" : "password"} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="text-slate-500 transition hover:text-white" aria-label="Toggle password visibility">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-300">Confirm password</label>
                <div className="flex items-center rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-3 transition focus-within:border-cyan-300/50">
                  <input id="confirmPassword" type={showConfirm ? "text" : "password"} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
                  <button type="button" onClick={() => setShowConfirm((value) => !value)} className="text-slate-500 transition hover:text-white" aria-label="Toggle confirm password visibility">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center rounded-[22px] bg-violet-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? "Creating account..." : "Sign up with email"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-400">
              Already have an account? <Link href="/sign-in" className="text-cyan-200 underline">Sign in</Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
