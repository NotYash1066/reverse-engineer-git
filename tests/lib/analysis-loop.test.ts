import { describe, expect, it } from "vitest";
import { runAnalysisLoop } from "@/lib/analysis-loop";
import { makeRepoSnapshot } from "../fixtures/repo-snapshots";

describe("runAnalysisLoop", () => {
  it("returns repo shape, coverage, and stage summaries", async () => {
    const snapshot = makeRepoSnapshot({
      allPaths: [
        "pnpm-workspace.yaml",
        "apps/web/package.json",
        "apps/web/src/app/page.tsx",
        "apps/api/package.json",
        "apps/api/src/index.ts",
      ],
      files: [
        { path: "pnpm-workspace.yaml", size: 32, content: "packages:\n  - apps/*\n" },
        { path: "apps/web/package.json", size: 80, content: '{"dependencies":{"next":"16.2.2"}}' },
      ],
    });

    const result = await runAnalysisLoop(
      {
        snapshot,
        seed: {
          repo: {
            fullName: "acme/example",
            url: "https://github.com/acme/example",
            description: "Example",
          },
          stack: ["TypeScript"],
          appType: "Software project",
          keyFeatures: ["Core behavior likely described in the repository README"],
          architectureNotes: ["Initial heuristic analysis"],
          evidence: ["Sampled files: 2"],
        },
        budget: {
          maxIterations: 2,
          maxFiles: 8,
          maxBytes: 50000,
          confidenceThreshold: 0.8,
        },
        llmConfig: {
          provider: "openai-compatible",
          model: "test-model",
          apiKey: "test-key",
        },
      },
      {
        invokeLlm: async () => ({
          summary: {
            stack: ["TypeScript", "Next.js"],
            appType: "Monorepo web application",
            keyFeatures: ["Web app and API"],
            architectureNotes: ["Workspace with separate web and api roots"],
            evidence: ["apps/web/package.json", "apps/api/src/index.ts"],
          },
          ambiguities: [],
          assumptions: [],
          continueAnalysis: false,
          contextRequests: [{ kind: "folder", path: "apps/api", reason: "Inspect the API root", priority: 10 }],
          confidence: {
            overall: 0.5,
            stack: 0.5,
            appType: 0.5,
            features: 0.5,
            architecture: 0.5,
          },
          notes: ["classification confirmed"],
        }),
        fetchFiles: async () => [{ path: "apps/api/src/index.ts", size: 42, content: "export const handler = true;" }],
      }
    );

    expect(result.meta.repoShape.kind).toBe("monorepo");
    expect(result.meta.coverage.status).toBe("representative");
    expect(result.meta.stageSummaries.map((stage) => stage.stage)).toEqual([
      "discovery",
      "classification",
      "targeted_retrieval",
      "synthesis",
      "scoring",
    ]);
  });

  it("does not exceed the configured file budget after retrieval", async () => {
    const snapshot = makeRepoSnapshot({
      allPaths: ["package.json", "next.config.ts", "app/page.tsx", "src/a.ts", "src/b.ts"],
      files: [{ path: "package.json", size: 20, content: '{"dependencies":{"next":"16.2.2"}}' }],
    });

    const result = await runAnalysisLoop(
      {
        snapshot,
        seed: {
          repo: {
            fullName: "acme/example",
            url: "https://github.com/acme/example",
            description: "Example",
          },
          stack: ["TypeScript"],
          appType: "Web application",
          keyFeatures: ["Repository analysis"],
          architectureNotes: ["Initial heuristic analysis"],
          evidence: ["Sampled files: 1"],
        },
        budget: {
          maxIterations: 1,
          maxFiles: 2,
          maxBytes: 200,
          confidenceThreshold: 0.9,
        },
        llmConfig: {
          provider: "openai-compatible",
          model: "test-model",
          apiKey: "test-key",
        },
      },
      {
        invokeLlm: async () => ({
          summary: {
            stack: ["TypeScript", "Next.js"],
            appType: "Web application",
            keyFeatures: ["Repository analysis"],
            architectureNotes: ["Budget aware retrieval"],
            evidence: ["package.json"],
          },
          ambiguities: [],
          assumptions: [],
          continueAnalysis: true,
          contextRequests: [
            { kind: "file", path: "src/a.ts", reason: "Inspect source", priority: 10 },
            { kind: "file", path: "src/b.ts", reason: "Inspect another source", priority: 9 },
          ],
          confidence: {
            overall: 0.3,
            stack: 0.3,
            appType: 0.3,
            features: 0.3,
            architecture: 0.3,
          },
          notes: ["Need more context"],
        }),
        fetchFiles: async (_fullName, paths) =>
          paths.map((path) => ({ path, size: 30, content: `export const value = '${path}';` })),
      }
    );

    expect(result.meta.budget.filesFetched).toBe(2);
    expect(result.meta.iterations[0]?.fetchedPaths).toEqual(["src/a.ts"]);
  });
});
