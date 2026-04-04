"use client";

import { useEffect, useRef, useState } from "react";
import { AnalysisResult } from "@/components/analysis-result";
import { RepoForm } from "@/components/repo-form";
import { AnalyzeRepoResponse } from "@/lib/types";

const PROCESS_STEPS = [
  "Normalize the submitted repository reference.",
  "Map the public tree and collect high-signal files.",
  "Refine the repo narrative into a rebuild brief.",
  "Return a prompt, confidence, and ambiguity readout.",
];

export function HomeShell() {
  const [result, setResult] = useState<AnalyzeRepoResponse | null>(null);
  const [status, setStatus] = useState("Awaiting a public GitHub repository for LLM analysis.");
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  return (
    <main className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col gap-12 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
      <section className="glass-panel relative overflow-hidden rounded-[2rem] px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(142,216,222,0.14),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(213,142,98,0.12),_transparent_25%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] xl:gap-12">
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--sand)]/85">
              <span className="eyebrow rounded-full border border-white/10 bg-white/5 px-4 py-2">
                Reverse engineer git
              </span>
              <span className="eyebrow rounded-full border border-[var(--copper)]/30 bg-[var(--copper)]/10 px-4 py-2 text-[var(--sand)]">
                Public repos only
              </span>
            </div>

            <div className="max-w-4xl space-y-5">
              <p className="eyebrow text-[var(--muted)]">Editorial forensic analysis for public codebases</p>
              <h1 className="font-display max-w-4xl text-5xl leading-[0.95] tracking-[-0.04em] text-[var(--foreground)] sm:text-6xl xl:text-[5.8rem]">
                Turn a repository into a reconstruction brief that actually feels informed.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
                Paste a public GitHub URL or owner/name. The app uses an LLM to study the repository
                structure, surface ambiguity, and deliver a reverse-engineering prompt that reads like
                a design dossier instead of a generic summary.
              </p>
            </div>

            <div className="paper-panel rounded-[1.8rem] p-5 sm:p-6 lg:p-7">
              <RepoForm onResult={setResult} onStatusChange={setStatus} />
            </div>

            <div className="status-pulse paper-panel rounded-[1.5rem] pl-12 pr-5 py-4 text-sm leading-7 text-[var(--sand)]/88">
              {status}
            </div>
          </div>

          <div className="grid gap-5 lg:pt-10">
            <div className="paper-panel rounded-[1.75rem] p-6 sm:p-7">
              <div className="soft-rule pb-4">
                <p className="eyebrow text-[var(--muted)]">Method</p>
                <h2 className="font-display mt-3 text-3xl tracking-[-0.03em] text-white">
                  A dossier, not a dump.
                </h2>
              </div>
              <ol className="mt-6 space-y-4">
                {PROCESS_STEPS.map((step, index) => (
                  <li key={step} className="grid grid-cols-[2.5rem_1fr] gap-4 text-sm leading-7 text-[var(--muted)]">
                    <span className="font-display flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg text-[var(--sand)]">
                      {index + 1}
                    </span>
                    <span className="pt-1">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="glass-panel rotate-[-2deg] rounded-[1.8rem] p-6 sm:p-7">
              <p className="eyebrow text-[var(--muted)]">What makes it memorable</p>
              <div className="soft-rule mt-3 pb-4">
                <p className="font-display text-3xl leading-tight tracking-[-0.03em] text-white">
                  It tells you what is known, what is inferred, and what is still uncertain.
                </p>
              </div>
              <p className="mt-5 text-sm leading-7 text-[var(--muted)]">
                The best reverse-engineering prompts do not fake certainty. This interface is built to
                surface confidence, assumptions, and boundaries so the final prompt remains useful when
                the repository is messy, incomplete, or distributed across multiple surfaces.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div ref={resultRef} className="result-anchor">
        {result ? <AnalysisResult result={result} /> : null}
      </div>
    </main>
  );
}
