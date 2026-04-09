import { buildPrompt } from "@/lib/build-prompt";
import { buildCoverage, computeConfidence } from "@/lib/analysis-scoring";
import { measureFiles } from "@/lib/context-selection";
import { fetchRepoFiles } from "@/lib/github";
import { invokeStructuredLlm } from "@/lib/llm";
import { classifyRepoShape } from "@/lib/repo-shape";
import { planTargetedPaths } from "@/lib/retrieval-planner";
import {
  AnalysisBudgetUsage,
  AnalysisIteration,
  AnalysisLoopInput,
  AnalysisLoopResult,
  AnalysisMeta,
  AnalysisStageSummary,
  AnalysisSummary,
  RepoAnalysis,
  RepoFile,
  StructuredLlmResponse,
} from "@/lib/types";

type AnalysisLoopDependencies = {
  invokeLlm?: typeof invokeStructuredLlm;
  fetchFiles?: typeof fetchRepoFiles;
};

export async function runAnalysisLoop(
  input: AnalysisLoopInput,
  deps: AnalysisLoopDependencies = {}
): Promise<AnalysisLoopResult> {
  const invokeLlm = deps.invokeLlm ?? invokeStructuredLlm;
  const fetchFiles = deps.fetchFiles ?? fetchRepoFiles;
  const llmConfig = input.llmConfig;
  const repoShape = classifyRepoShape(input.snapshot);
  const fetchedFiles = [...input.snapshot.files];
  const fetchedPaths = input.snapshot.files.map((file) => file.path);
  const stageSummaries: AnalysisStageSummary[] = [
    {
      stage: "discovery",
      requestedPaths: [],
      fetchedPaths: [...fetchedPaths],
      notes: ["Loaded initial repository snapshot"],
    },
    {
      stage: "classification",
      requestedPaths: [],
      fetchedPaths: [],
      notes: [`Classified repository as ${repoShape.kind}`],
    },
  ];
  let summary = toSummary(input.seed);
  let ambiguities: StructuredLlmResponse["ambiguities"] = [];
  let assumptions: string[] = [];
  const iterations: AnalysisIteration[] = [];
  let stopReason: AnalysisMeta["stopReason"] = "budget_reached";
  let confidence = defaultConfidence();

  for (let index = 0; index < input.budget.maxIterations; index += 1) {
    const llmResponse = await invokeLlm(
      llmConfig,
      buildLoopPrompt({
        repo: input.seed.repo.fullName,
        repoShape,
        summary,
        fetchedFiles,
        remainingBudget: {
          iterations: input.budget.maxIterations - index,
          maxFiles: input.budget.maxFiles - fetchedFiles.length,
          maxBytes: input.budget.maxBytes - measureFiles(fetchedFiles),
        },
        ambiguities,
        assumptions,
      })
    );

    summary = llmResponse.summary;
    ambiguities = llmResponse.ambiguities;
    assumptions = llmResponse.assumptions;

    const nextPaths = planTargetedPaths({
      allPaths: input.snapshot.allPaths,
      shape: repoShape,
      alreadyFetched: fetchedPaths,
      requestedPaths: llmResponse.contextRequests.map((request) => request.path),
    });
    const nextFiles = await fetchFiles(input.snapshot.repo.full_name, nextPaths);

    fetchedFiles.push(...nextFiles);
    fetchedPaths.push(...nextFiles.map((file) => file.path));

    iterations.push({
      index: index + 1,
      requestedPaths: llmResponse.contextRequests.map((request) => request.path),
      fetchedPaths: nextFiles.map((file) => file.path),
      confidence: llmResponse.confidence,
      unresolvedAmbiguities: ambiguities.filter((ambiguity) => ambiguity.status === "open").length,
      notes: llmResponse.notes,
    });

    stageSummaries.push({
      stage: "targeted_retrieval",
      requestedPaths: llmResponse.contextRequests.map((request) => request.path),
      fetchedPaths: nextFiles.map((file) => file.path),
      notes: llmResponse.notes,
    });

    if (llmResponse.confidence.overall >= input.budget.confidenceThreshold && !hasHighOpenAmbiguity(ambiguities)) {
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

  stageSummaries.push({
    stage: "synthesis",
    requestedPaths: [],
    fetchedPaths: [],
    notes: ["Merged heuristic and model findings into final summary"],
  });

  const coverage = buildCoverage({
    shape: repoShape,
    fetchedPaths,
    bytesFetched: measureFiles(fetchedFiles),
  });
  confidence = computeConfidence({ coverage, ambiguities, assumptions });

  stageSummaries.push({
    stage: "scoring",
    requestedPaths: [],
    fetchedPaths: [],
    notes: [`Coverage status: ${coverage.status}`],
  });

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
      repoShape,
      coverage,
      stageSummaries,
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
  repoShape: AnalysisMeta["repoShape"];
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
      repoShape: input.repoShape,
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
