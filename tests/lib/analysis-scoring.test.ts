import { describe, expect, it } from "vitest";
import { buildCoverage, computeConfidence } from "@/lib/analysis-scoring";
import { RepoShape } from "@/lib/types";

const shape: RepoShape = {
  kind: "monorepo",
  roots: [
    { path: "apps/web", kind: "app", reason: "apps package manifest" },
    { path: "apps/api", kind: "service", reason: "apps package manifest" },
  ],
  signals: ["workspace manifest"],
  ambiguous: false,
};

describe("buildCoverage", () => {
  it("marks representative coverage when each root has inspected files", () => {
    const coverage = buildCoverage({
      shape,
      fetchedPaths: ["apps/web/package.json", "apps/api/src/index.ts"],
      bytesFetched: 9000,
    });

    expect(coverage.status).toBe("representative");
    expect(coverage.inspectedRoots).toEqual(["apps/web", "apps/api"]);
  });
});

describe("computeConfidence", () => {
  it("reduces overall confidence for high-severity ambiguities", () => {
    const confidence = computeConfidence({
      coverage: {
        status: "representative",
        inspectedRoots: ["apps/web", "apps/api"],
        representativeRoots: ["apps/web", "apps/api"],
        fileCount: 6,
        bytesFetched: 9000,
        gaps: [],
      },
      ambiguities: [
        {
          topic: "primary runtime",
          reason: "Both frontend and backend entrypoints were found",
          severity: "high",
          status: "open",
          relatedPaths: ["apps/web/package.json", "apps/api/package.json"],
        },
      ],
      assumptions: ["The web app is the primary user-facing surface."],
    });

    expect(confidence.overall).toBeLessThan(0.8);
    expect(confidence.architecture).toBeLessThan(confidence.stack);
  });
});

describe("buildCoverage for root repos", () => {
  it("does not mark the root as inspected from an arbitrary nested file", () => {
    const coverage = buildCoverage({
      shape: {
        kind: "single-app",
        roots: [{ path: ".", kind: "app", reason: "root app manifests" }],
        signals: ["root package.json"],
        ambiguous: false,
      },
      fetchedPaths: ["lib/internal.ts"],
      bytesFetched: 200,
    });

    expect(coverage.status).toBe("narrow");
    expect(coverage.inspectedRoots).toEqual([]);
    expect(coverage.gaps).toEqual(["No representative file fetched for ."]);
  });
});
