import { AnalysisAmbiguity, AnalysisConfidence, AnalysisCoverage, RepoShape } from "@/lib/types";

export function buildCoverage(input: {
  shape: RepoShape;
  fetchedPaths: string[];
  bytesFetched: number;
}): AnalysisCoverage {
  const inspectedRoots = input.shape.roots
    .map((root) => root.path)
    .filter((root) => input.fetchedPaths.some((path) => (root === "." ? true : path.startsWith(root))));

  const missingRoots = input.shape.roots
    .map((root) => root.path)
    .filter((root) => !inspectedRoots.includes(root));

  const status =
    inspectedRoots.length === 0
      ? "narrow"
      : missingRoots.length === 0
        ? inspectedRoots.length > 2
          ? "broad"
          : "representative"
        : "narrow";

  return {
    status,
    inspectedRoots,
    representativeRoots: input.shape.roots.map((root) => root.path),
    fileCount: input.fetchedPaths.length,
    bytesFetched: input.bytesFetched,
    gaps: missingRoots.map((root) => `No representative file fetched for ${root}`),
  };
}

export function computeConfidence(input: {
  coverage: AnalysisCoverage;
  ambiguities: AnalysisAmbiguity[];
  assumptions: string[];
}): AnalysisConfidence {
  const openHigh = input.ambiguities.filter(
    (ambiguity) => ambiguity.status === "open" && ambiguity.severity === "high"
  ).length;
  const coverageBonus =
    input.coverage.status === "broad"
      ? 0.15
      : input.coverage.status === "representative"
        ? 0.08
        : -0.08;
  const ambiguityPenalty = openHigh * 0.15;
  const assumptionPenalty = Math.min(input.assumptions.length * 0.03, 0.12);
  const overall = Math.max(
    0.2,
    Math.min(0.95, 0.72 + coverageBonus - ambiguityPenalty - assumptionPenalty)
  );

  return {
    overall,
    stack: Math.max(0.2, overall + 0.05),
    appType: overall,
    features: Math.max(0.2, overall - 0.03),
    architecture: Math.max(0.2, overall - 0.08),
  };
}
