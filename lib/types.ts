export type RepoReference = {
  owner: string;
  repo: string;
  normalized: string;
  url: string;
};

export type RepoMetadata = {
  full_name: string;
  name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  topics: string[];
  homepage: string | null;
  license: {
    name: string;
  } | null;
};

export type RepoFile = {
  path: string;
  content: string;
  size: number;
};

export type RepoSnapshot = {
  repo: RepoMetadata;
  rootEntries: string[];
  allPaths: string[];
  files: RepoFile[];
};

export type RepoAnalysis = {
  repo: {
    fullName: string;
    url: string;
    description: string | null;
  };
  stack: string[];
  appType: string;
  keyFeatures: string[];
  architectureNotes: string[];
  evidence: string[];
};

export type LlmProviderId =
  | "anthropic"
  | "openai-compatible"
  | "gemini"
  | "github-models";

export type LlmConfig = {
  provider: LlmProviderId;
  model: string;
  apiKey?: string;
  baseUrl?: string;
};

export type AnalysisConfidence = {
  overall: number;
  stack: number;
  appType: number;
  features: number;
  architecture: number;
};

export type AnalysisAmbiguity = {
  topic: string;
  reason: string;
  severity: "low" | "medium" | "high";
  status: "open" | "resolved" | "assumed";
  relatedPaths: string[];
};

export type AnalysisSummary = {
  stack: string[];
  appType: string;
  keyFeatures: string[];
  architectureNotes: string[];
  evidence: string[];
};

export type AnalysisContextRequest = {
  kind: "file" | "folder";
  path: string;
  reason: string;
  priority: number;
};

export type AnalysisIteration = {
  index: number;
  requestedPaths: string[];
  fetchedPaths: string[];
  confidence: AnalysisConfidence;
  unresolvedAmbiguities: number;
  notes: string[];
};

export type AnalysisStopReason =
  | "confidence_reached"
  | "budget_reached"
  | "no_more_context"
  | "model_completed";

export type AnalysisBudget = {
  maxIterations: number;
  maxFiles: number;
  maxBytes: number;
  confidenceThreshold: number;
};

export type AnalysisBudgetUsage = {
  iterations: number;
  filesFetched: number;
  bytesFetched: number;
};

export type AnalysisMeta = {
  provider: LlmProviderId | "heuristic";
  model: string;
  stopReason: AnalysisStopReason;
  confidence: AnalysisConfidence;
  ambiguities: AnalysisAmbiguity[];
  iterations: AnalysisIteration[];
  budget: AnalysisBudgetUsage;
  assumptions: string[];
};

export type AnalyzeRepoResponse = {
  normalizedRepo: string;
  summary: AnalysisSummary;
  prompt: string;
  analysisMeta: AnalysisMeta;
};

export type AnalysisLoopInput = {
  snapshot: RepoSnapshot;
  seed: RepoAnalysis;
  budget: AnalysisBudget;
  llmConfig: LlmConfig | null;
};

export type AnalysisLoopResult = {
  summary: AnalysisSummary;
  meta: AnalysisMeta;
};

export type StructuredLlmResponse = {
  summary: {
    stack: string[];
    appType: string;
    keyFeatures: string[];
    architectureNotes: string[];
    evidence: string[];
  };
  confidence: AnalysisConfidence;
  ambiguities: AnalysisAmbiguity[];
  assumptions: string[];
  continueAnalysis: boolean;
  contextRequests: AnalysisContextRequest[];
  notes: string[];
};
