"use client";

import { FormEvent, useState } from "react";
import { AnalyzeRepoResponse } from "@/lib/types";

type RepoFormProps = {
  onResult: (result: AnalyzeRepoResponse | null) => void;
  onStatusChange: (status: string) => void;
};

export function RepoForm({ onResult, onStatusChange }: RepoFormProps) {
  const [repo, setRepo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    onResult(null);
    onStatusChange("Fetching repository context...");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ repo }),
      });

      onStatusChange("Generating reverse-engineering analysis...");
      const data = (await response.json()) as AnalyzeRepoResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Analysis failed.");
      }

      onResult(data);
      onStatusChange("Analysis complete. Results are shown below.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed.";
      setError(message);
      onStatusChange(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <label className="grid gap-2">
          <span className="eyebrow text-[var(--muted)]">Repository target</span>
          <input
            type="text"
            value={repo}
            onChange={(event) => setRepo(event.target.value)}
            placeholder="NotYash1066/Skill-Swap or https://github.com/NotYash1066/Skill-Swap"
            className="min-h-15 rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-5 py-4 text-base text-white outline-none transition duration-200 placeholder:text-[var(--muted)]/55 focus:border-[var(--cyan)]/65 focus:bg-white/[0.06]"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="min-h-15 rounded-[1.35rem] border border-[var(--sand)]/15 bg-[linear-gradient(135deg,_rgba(243,226,191,0.95),_rgba(213,142,98,0.92))] px-6 text-sm font-semibold uppercase tracking-[0.18em] text-[#1a1411] transition duration-200 hover:scale-[1.01] hover:shadow-[0_16px_40px_rgba(213,142,98,0.18)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Analyzing" : "Analyze repo"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
          public repositories only
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
          LLM-backed repository analysis
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
          confidence + ambiguity aware
        </span>
      </div>

      {error ? <p className="text-sm text-[#ffb39f]">{error}</p> : null}
    </form>
  );
}
