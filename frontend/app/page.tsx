"use client";

import { useEffect, useState } from "react";

import { FileUpload } from "../components/FileUpload";
import { hasSupabasePublicConfig, supabase } from "../lib/supabase";

type Status = {
  status: string;
  ok: boolean;
};

const unavailableBackend: Status = {
  status: "Backend connection unavailable",
  ok: false,
};

const missingSupabaseConfig: Status = {
  status: "Supabase public configuration is missing",
  ok: false,
};

export default function Home() {
  const [backend, setBackend] = useState<Status>({
    status: "Checking backend connection...",
    ok: false,
  });
  const [supabaseStatus, setSupabaseStatus] = useState<Status>({
    status: "Checking Supabase public client...",
    ok: false,
  });

  useEffect(() => {
    let active = true;

    async function checkBackend() {
      try {
        const response = await fetch("/api/test-backend", { cache: "no-store" });
        const data = (await response.json()) as Status;

        if (active) {
          setBackend(data);
        }
      } catch {
        if (active) {
          setBackend(unavailableBackend);
        }
      }
    }

    async function checkSupabase() {
      if (!hasSupabasePublicConfig() || !supabase) {
        setSupabaseStatus(missingSupabaseConfig);
        return;
      }

      try {
        const { error } = await supabase
          .from("documents")
          .select("id")
          .limit(1);

        if (!active) {
          return;
        }

        if (error) {
          setSupabaseStatus({
            ok: false,
            status: "Supabase public client initialized but access is restricted by policy",
          });
          return;
        }

        setSupabaseStatus({
          ok: true,
          status: "Supabase public client initialized",
        });
      } catch {
        if (active) {
          setSupabaseStatus({
            ok: false,
            status: "Supabase public client connection failed",
          });
        }
      }
    }

    checkBackend();
    checkSupabase();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-1 bg-slate-950 px-6 py-12 text-slate-100">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-cyan-950/30">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            IntelliSeek
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight">
            Upload & Parse Academic Documents
          </h1>
          <p className="mt-4 text-lg text-slate-300">
            Upload PDF, DOCX, PPTX, or TXT files to build your academic knowledge base.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatusCard
            label="Frontend"
            title="Running"
            status="http://localhost:3000"
            ok
          />
          <StatusCard
            label="Backend"
            title={backend.ok ? "Healthy" : "Unavailable"}
            status={backend.status}
            ok={backend.ok}
          />
          <StatusCard
            label="Supabase"
            title={supabaseStatus.ok ? "Connected" : "Check needed"}
            status={supabaseStatus.status}
            ok={supabaseStatus.ok}
          />
        </div>

        <div>
          <h2 className="mb-4 text-xl font-semibold text-slate-200">
            Upload a Document
          </h2>
          <FileUpload />
        </div>
      </section>
    </main>
  );
}

type StatusCardProps = {
  label: string;
  title: string;
  status: string;
  ok: boolean;
};

function StatusCard({ label, title, status, ok }: StatusCardProps) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        ok
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-amber-500/30 bg-amber-500/10"
      }`}
    >
      <p className={`text-sm font-medium ${ok ? "text-emerald-200" : "text-amber-200"}`}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{title}</p>
      <p className={`mt-2 text-sm ${ok ? "text-emerald-100/80" : "text-amber-100/80"}`}>
        {status}
      </p>
    </div>
  );
}
