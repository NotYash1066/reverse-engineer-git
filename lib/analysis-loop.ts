import { buildPrompt } from "@/lib/build-prompt";
import { measureFiles, selectRequestedPaths } from "@/lib/context-selection";
import { fetchRepoFiles } from "@/lib/github";
import { invokeStructuredLlm } from "@/lib/llm";
import {
  AnalysisBudgetUsage,
  AnalysisIteration,
  AnalysisLoopInput,
  AnalysisLoopResult,
  AnalysisMeta,
  AnalysisSummary,
  RepoAnalysis,
  RepoFile,
  StructuredLlmResponse,
} from "@/lib/types";

export async function runAnalysisLoop(input: AnalysisLoopInput): Promise<AnalysisLoopResult> {
  const llmConfig = input.llmConfig;
  const fetchedFiles = [...input.snapshot.files];
  const fetchedPaths = input.snapshot.files.map((file) => file.path);
  let summary = toSummary(input.seed);
  let ambiguities: StructuredLlmResponse["ambiguities"] = [];
  let assumptions: string[] = [];
  const iterations: AnalysisIteration[] = [];
  let stopReason: AnalysisMeta["stopReason"] = "budget_reached";
  let confidence = defaultConfidence();

  for (let index = 0; index < input.budget.maxIterations; index += 1) {
    const llmResponse = await invokeStructuredLlm(llmConfig, buildLoopPrompt({
      repo: input.seed.repo.fullName,
      summary,
      fetchedFiles,
      remainingBudget: {
        iterations: input.budget.maxIterations - index,
        maxFiles: input.budget.maxFiles - fetchedFiles.length,
        maxBytes: input.budget.maxBytes - measureFiles(fetchedFiles),
      },
      ambiguities,
      assumptions,
    }));

    summary = llmResponse.summary;
    ambiguities = llmResponse.ambiguities;
    assumptions = llmResponse.assumptions;
    confidence = llmResponse.confidence;

    const nextPaths = selectRequestedPaths(input.snapshot.allPaths, llmResponse.contextRequests, fetchedPaths);
    const nextFiles = await fetchRepoFiles(input.snapshot.repo.full_name, nextPaths);

    fetchedFiles.push(...nextFiles);
    fetchedPaths.push(...nextFiles.map((file) => file.path));

    iterations.push({
      index: index + 1,
      requestedPaths: llmResponse.contextRequests.map((request) => request.path),
      fetchedPaths: nextFiles.map((file) => file.path),
      confidence,
      unresolvedAmbiguities: ambiguities.filter((ambiguity) => ambiguity.status === "open").length,
      notes: llmResponse.notes,
    });

    if (confidence.overall >= input.budget.confidenceThreshold && !hasHighOpenAmbiguity(ambiguities)) {
      stopReason = "confidence_reached";
      break;
    }

    if (!llmResponse.continueAnalysis) {
      stopReason = "model_completed";
      break;
    }

    if (nextFiles.length === 0) {
      stopReason = "no_more_context";
      break;
    }

    if (
      fetchedFiles.length >= input.budget.maxFiles ||
      measureFiles(fetchedFiles) >= input.budget.maxBytes
    ) {
      stopReason = "budget_reached";
      break;
    }
  }

  const budget: AnalysisBudgetUsage = {
    iterations: iterations.length,
    filesFetched: fetchedFiles.length,
    bytesFetched: measureFiles(fetchedFiles),
  };

  return {
    summary,
    meta: {
      provider: llmConfig.provider,
      model: llmConfig.model,
      stopReason,
      confidence,
      ambiguities,
      iterations,
      budget,
      assumptions,
    },
  };
}

export function buildFinalPrompt(result: AnalysisLoopResult, analysis: RepoAnalysis): string {
  const assumptions = result.meta.assumptions.filter((assumption) => assumption.trim().length > 0);

  return buildPrompt({
    ...analysis,
    stack: result.summary.stack,
    appType: result.summary.appType,
    keyFeatures: result.summary.keyFeatures,
    architectureNotes: result.summary.architectureNotes,
    evidence: result.summary.evidence,
    assumptions,
  });
}

function toSummary(analysis: RepoAnalysis): AnalysisSummary {
  return {
    stack: analysis.stack,
    appType: analysis.appType,
    keyFeatures: analysis.keyFeatures,
    architectureNotes: analysis.architectureNotes,
    evidence: analysis.evidence,
  };
}

function buildLoopPrompt(input: {
  repo: string;
  summary: AnalysisSummary;
  fetchedFiles: RepoFile[];
  remainingBudget: {
    iterations: number;
    maxFiles: number;
    maxBytes: number;
  };
  ambiguities: StructuredLlmResponse["ambiguities"];
  assumptions: string[];
}): string {
  return JSON.stringify(
    {
      instructions: [
        "Analyze the repository context and refine the reverse-engineering summary.",
        "Return valid JSON only.",
        "If more context is needed, request specific files or folders from the provided repository tree.",
        "Use continueAnalysis=false when confidence is high enough or there is no more valuable context to request.",
      ],
      repo: input.repo,
      currentSummary: input.summary,
      currentAmbiguities: input.ambiguities,
      currentAssumptions: input.assumptions,
      remainingBudget: input.remainingBudget,
      fetchedFiles: input.fetchedFiles.map((file) => ({
        path: file.path,
        size: file.size,
        content: file.content.slice(0, 12000),
      })),
      responseSchema: {
        summary: {
          stack: ["string"],
          appType: "string",
          keyFeatures: ["string"],
          architectureNotes: ["string"],
          evidence: ["string"],
        },
        confidence: {
          overall: "0..1",
          stack: "0..1",
          appType: "0..1",
          features: "0..1",
          architecture: "0..1",
        },
        ambiguities: [
          {
            topic: "string",
            reason: "string",
            severity: "low|medium|high",
            status: "open|resolved|assumed",
            relatedPaths: ["string"],
          },
        ],
        assumptions: ["string"],
        continueAnalysis: "boolean",
        contextRequests: [
          {
            kind: "file|folder",
            path: "string",
            reason: "string",
            priority: "number",
          },
        ],
        notes: ["string"],
      },
    },
    null,
    2
  );
}

function defaultConfidence() {
  return {
    overall: 0.55,
    stack: 0.6,
    appType: 0.55,
    features: 0.5,
    architecture: 0.5,
  };
}

function hasHighOpenAmbiguity(ambiguities: StructuredLlmResponse["ambiguities"]): boolean {
  return ambiguities.some((ambiguity) => ambiguity.severity === "high" && ambiguity.status === "open");
}
