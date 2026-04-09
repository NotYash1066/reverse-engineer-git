import { AnalysisAmbiguity, AnalysisCoverage, RepoAnalysis, RepoShape } from "@/lib/types";

type PromptAnalysis = RepoAnalysis & {
  assumptions?: string[];
  ambiguities?: AnalysisAmbiguity[];
  repoShape?: RepoShape;
  coverage?: AnalysisCoverage;
};

export function buildPrompt(analysis: PromptAnalysis): string {
  const stack = analysis.stack.length > 0 ? analysis.stack.join(", ") : "Unknown stack";
  const features = toBulletList(analysis.keyFeatures);
  const architecture = toBulletList(analysis.architectureNotes);
  const evidence = toBulletList(analysis.evidence);
  const assumptions = (analysis.assumptions ?? []).filter((assumption) => assumption.trim().length > 0);
  const ambiguities = (analysis.ambiguities ?? []).filter((ambiguity) => ambiguity.status === "open");
  const hasAssumptions = assumptions.length > 0;
  const hasAmbiguities = ambiguities.length > 0;
  const repoShape = analysis.repoShape
    ? `${analysis.repoShape.kind} (${analysis.repoShape.signals.join(", ") || "shape signals unavailable"})`
    : "Unknown";
  const coverage = analysis.coverage
    ? `${analysis.coverage.status}; inspected roots: ${analysis.coverage.inspectedRoots.join(", ") || "none"}`
    : "Coverage unknown";

  return [
    `Reverse engineer and recreate a project inspired by ${analysis.repo.fullName} (${analysis.repo.url}).`,
    "",
    "Match the original project at a product and architecture level without copying code verbatim.",
    "",
    "Repository context:",
    `- Description: ${analysis.repo.description ?? "No description provided."}`,
    `- App type: ${analysis.appType}`,
    `- Repository shape: ${repoShape}`,
    `- Analysis coverage: ${coverage}`,
    `- Detected stack: ${stack}`,
    "",
    "Likely major features to reproduce:",
    features,
    "",
    "Architecture and implementation clues:",
    architecture,
    "",
    "Observed evidence from the public repository:",
    evidence,
    "",
    ...(hasAmbiguities
      ? [
          "Unresolved ambiguities to account for:",
          toBulletList(ambiguities.map((ambiguity) => `${ambiguity.topic}: ${ambiguity.reason}`)),
          "",
        ]
      : []),
    ...(hasAssumptions
      ? [
          "Model-produced assumptions to preserve:",
          toBulletList(assumptions),
          "",
        ]
      : []),
    "Implementation instructions:",
    "- Recreate the product scope, folder structure, and technical choices suggested by the evidence above.",
    "- Preserve the likely user flows and module boundaries.",
    "- Use the detected stack unless there is a strong reason to substitute a close equivalent.",
    "- Start with the core path and highest-signal features before adding polish.",
    ...(hasAssumptions
      ? ["- Preserve the explicit assumptions listed above when resolving any remaining ambiguity."]
      : []),
    "",
    "Output format:",
    "1. Short project summary.",
    "2. Proposed architecture and folder layout.",
    "3. Step-by-step implementation plan.",
    "4. Key components, services, and data flows.",
    hasAssumptions ? "5. Final build notes and assumptions." : "5. Final build notes.",
  ].join("\n");
}

function toBulletList(items: string[]): string {
  if (items.length === 0) {
    return "- None identified confidently from the available public signals.";
  }

  return items.map((item) => `- ${item}`).join("\n");
}
