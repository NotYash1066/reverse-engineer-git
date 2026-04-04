import { runAnalysisLoop, buildFinalPrompt } from "@/lib/analysis-loop";
import { analyzeRepo } from "@/lib/analyze-repo";
import { fetchRepoSnapshot } from "@/lib/github";
import { resolveLlmConfig } from "@/lib/llm";
import { parseRepoInput } from "@/lib/parse-repo-input";
import { AnalyzeRepoResponse } from "@/lib/types";

const DEFAULT_BUDGET = {
  maxIterations: 4,
  maxFiles: 24,
  maxBytes: 350_000,
  confidenceThreshold: 0.8,
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { repo?: string };
    const rawRepo = body.repo ?? "";
    const parsed = parseRepoInput(rawRepo);
    const snapshot = await fetchRepoSnapshot(parsed.normalized);
    const seed = analyzeRepo(snapshot);
    const llmConfig = resolveLlmConfig();
    const loopResult = await runAnalysisLoop({
      snapshot,
      seed,
      budget: DEFAULT_BUDGET,
      llmConfig,
    });

    const response: AnalyzeRepoResponse = {
      normalizedRepo: parsed.normalized,
      summary: loopResult.summary,
      prompt: buildFinalPrompt(loopResult, seed),
      analysisMeta: loopResult.meta,
    };

    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error during analysis.";
    return Response.json({ error: message }, { status: 400 });
  }
}
