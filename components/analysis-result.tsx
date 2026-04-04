"use client";

import { useMemo, useState } from "react";
import { AnalyzeRepoResponse } from "@/lib/types";

type AnalysisResultProps = {
  result: AnalyzeRepoResponse;
};

export function AnalysisResult({ result }: AnalysisResultProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const downloadName = useMemo(
    () => `${result.normalizedRepo.replace(/[\/]/g, "-")}-reverse-engineering-prompt.txt`,
    [result.normalizedRepo]
  );
  const llmAssumptions = result.analysisMeta.assumptions.filter(
    (assumption) => assumption.trim().length > 0
  );

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result.prompt);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  function handleDownload() {
    const blob = new Blob([result.prompt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = downloadName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr] xl:gap-8">
      <div className="space-y-6">
        <div className="paper-panel rounded-[1.9rem] p-6 sm:p-7">
          <div className="soft-rule pb-5">
            <p className="eyebrow text-[var(--muted)]">Repository summary</p>
            <h2 className="font-display mt-3 text-4xl leading-none tracking-[-0.04em] text-white">
              {result.normalizedRepo}
            </h2>
          </div>

          <div className="mt-6 space-y-5">
            <SummaryBlock title="Detected stack" items={result.summary.stack} />
            <SummaryBlock title="App type" items={[result.summary.appType]} />
            <SummaryBlock title="Key features" items={result.summary.keyFeatures} />
            <SummaryBlock title="Architecture notes" items={result.summary.architectureNotes} />
            <SummaryBlock title="Evidence" items={result.summary.evidence} />
          </div>
        </div>

        <div className="glass-panel rounded-[1.9rem] p-6 sm:p-7">
          <div className="soft-rule pb-5">
            <p className="eyebrow text-[var(--muted)]">Confidence ledger</p>
            <h3 className="font-display mt-3 text-3xl leading-none tracking-[-0.035em] text-white">
              Analysis metadata
            </h3>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <MetaItem label="Provider" value={result.analysisMeta.provider} />
            <MetaItem label="Model" value={result.analysisMeta.model} />
            <MetaItem label="Stop reason" value={result.analysisMeta.stopReason.replace(/_/g, " ")} />
            <MetaItem label="Iterations" value={String(result.analysisMeta.budget.iterations)} />
            <MetaItem
              label="Overall confidence"
              value={`${Math.round(result.analysisMeta.confidence.overall * 100)}%`}
            />
            <MetaItem label="Files fetched" value={String(result.analysisMeta.budget.filesFetched)} />
          </div>

          <div className="mt-6 grid gap-5">
            <SummaryBlock
              title="Ambiguities"
              items={
                result.analysisMeta.ambiguities.length > 0
                  ? result.analysisMeta.ambiguities.map(
                      (ambiguity) => `${ambiguity.topic}: ${ambiguity.reason} (${ambiguity.status})`
                    )
                  : ["No major ambiguities were left unresolved."]
              }
            />
            {llmAssumptions.length > 0 ? (
              <SummaryBlock title="Assumptions" items={llmAssumptions} />
            ) : null}
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-[2rem] p-6 sm:p-7 lg:p-8">
        <div className="soft-rule mb-5 pb-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="eyebrow text-[var(--muted)]">Generated reconstruction brief</p>
              <h2 className="font-display mt-3 text-4xl leading-none tracking-[-0.04em] text-white sm:text-[3.3rem]">
                Reverse-engineering prompt
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-full border border-white/10 bg-white/8 px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-white/14"
              >
                {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy"}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="rounded-full border border-[var(--sand)]/18 bg-[linear-gradient(135deg,_rgba(243,226,191,0.95),_rgba(213,142,98,0.92))] px-5 py-2.5 text-sm font-semibold text-[#1a1411] transition hover:scale-[1.01]"
              >
                Download .txt
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/8 bg-black/25 p-4 sm:p-5">
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[13px] leading-7 text-[var(--sand)]/92 sm:text-sm">
            {result.prompt}
          </pre>
        </div>
      </div>
    </section>
  );
}

type SummaryBlockProps = {
  title: string;
  items: string[];
};

function SummaryBlock({ title, items }: SummaryBlockProps) {
  return (
    <div>
      <h3 className="eyebrow mb-3 text-[var(--muted)]">{title}</h3>
      <ul className="space-y-2.5 text-sm leading-7 text-[var(--foreground)]/82">
        {items.map((item) => (
          <li
            key={`${title}-${item}`}
            className="rounded-[1.1rem] border border-white/7 bg-white/[0.03] px-4 py-3"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

type MetaItemProps = {
  label: string;
  value: string;
};

function MetaItem({ label, value }: MetaItemProps) {
  return (
    <div className="rounded-[1.25rem] border border-white/7 bg-black/20 px-4 py-4">
      <p className="eyebrow text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
