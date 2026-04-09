import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/parse-repo-input", () => ({
  parseRepoInput: () => ({
    owner: "acme",
    repo: "example",
    normalized: "acme/example",
    url: "https://github.com/acme/example",
  }),
}));

vi.mock("@/lib/llm", () => ({
  LlmConfigError: class LlmConfigError extends Error {},
  resolveLlmConfig: () => ({ provider: "openai-compatible", model: "test-model", apiKey: "test-key" }),
}));

vi.mock("@/lib/github", () => ({
  fetchRepoSnapshot: async () => ({
    repo: {
      full_name: "acme/example",
      html_url: "https://github.com/acme/example",
      description: "Example",
      default_branch: "main",
      language: "TypeScript",
      topics: [],
      license: null,
    },
    rootEntries: [],
    allPaths: [],
    files: [],
  }),
}));

vi.mock("@/lib/analyze-repo", () => ({
  analyzeRepo: () => ({
    repo: { fullName: "acme/example", url: "https://github.com/acme/example", description: "Example" },
    stack: ["TypeScript"],
    appType: "Web application",
    keyFeatures: ["Repository analysis"],
    architectureNotes: ["Staged analysis"],
    evidence: ["README.md"],
  }),
}));

vi.mock("@/lib/analysis-loop", () => ({
  runAnalysisLoop: async () => ({
    summary: {
      stack: ["TypeScript", "Next.js"],
      appType: "Web application",
      keyFeatures: ["Repository analysis"],
      architectureNotes: ["Staged analysis"],
      evidence: ["README.md"],
    },
    meta: {
      provider: "openai-compatible",
      model: "test-model",
      stopReason: "confidence_reached",
      confidence: { overall: 0.84, stack: 0.88, appType: 0.84, features: 0.8, architecture: 0.78 },
      ambiguities: [],
      iterations: [],
      budget: { iterations: 1, filesFetched: 4, bytesFetched: 1234 },
      assumptions: [],
      repoShape: {
        kind: "single-app",
        roots: [{ path: ".", kind: "app", reason: "root app manifests" }],
        signals: ["root package.json"],
        ambiguous: false,
      },
      coverage: {
        status: "representative",
        inspectedRoots: ["."],
        representativeRoots: ["."],
        fileCount: 4,
        bytesFetched: 1234,
        gaps: [],
      },
      stageSummaries: [],
    },
  }),
  buildFinalPrompt: () => "reverse-engineering prompt",
}));

import { POST } from "@/app/api/analyze/route";

describe("POST /api/analyze", () => {
  it("returns the existing top-level shape plus additive analysis metadata", async () => {
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({ repo: "acme/example" }),
        headers: { "Content-Type": "application/json" },
      })
    );

    const json = await response.json();

    expect(json.normalizedRepo).toBe("acme/example");
    expect(json.summary.appType).toBe("Web application");
    expect(json.prompt).toBe("reverse-engineering prompt");
    expect(json.analysisMeta.repoShape.kind).toBe("single-app");
    expect(json.analysisMeta.coverage.status).toBe("representative");
  });
});
