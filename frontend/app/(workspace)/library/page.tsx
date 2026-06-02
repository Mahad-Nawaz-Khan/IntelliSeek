import { FileText, Library } from "lucide-react";

import { BUILT_IN_SOURCES, SAMPLE_UPLOAD_ITEMS } from "../../../lib/ui-state";

export default function LibraryPage() {
  return (
    <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200">
              <Library className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">Knowledge Library</p>
              <h1 className="mt-1 text-3xl font-semibold text-white">Uploaded and built-in sources</h1>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">Review the academic files IntelliSeek can use for source-grounded answers. Long filenames stay contained so the layout remains clean.</p>
        </header>

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <SourceSection title="Built-in Knowledge Base" items={BUILT_IN_SOURCES.map((source) => ({ id: source.id, filename: source.filename, status: source.status, summary: source.summary }))} />
          <SourceSection title="Your Uploads" items={SAMPLE_UPLOAD_ITEMS.map((item) => ({ id: item.id, filename: item.filename, status: item.status, summary: item.sizeLabel }))} />
        </section>
      </div>
    </div>
  );
}

type SourceSectionProps = {
  title: string;
  items: { id: string; filename: string; status: string; summary?: string }[];
};

function SourceSection({ title, items }: SourceSectionProps) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/55 p-5 shadow-xl shadow-slate-950/30 backdrop-blur-xl">
      <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.05] p-4">
              <div className="flex min-w-0 items-start gap-3">
                <FileText className="mt-1 h-5 w-5 shrink-0 text-cyan-200" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-100" title={item.filename}>{item.filename}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-200">{item.status}</p>
                  {item.summary && <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">{item.summary}</p>}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-500">No sources yet. Upload notes from the assistant workspace to populate this library.</p>
      )}
    </section>
  );
}
