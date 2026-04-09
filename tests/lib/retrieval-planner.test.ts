import { describe, expect, it } from "vitest";
import { planDiscoveryPaths, planTargetedPaths } from "@/lib/retrieval-planner";
import { RepoShape } from "@/lib/types";

const monorepoShape: RepoShape = {
  kind: "monorepo",
  roots: [
    { path: "apps/web", kind: "app", reason: "apps package manifest" },
    { path: "apps/api", kind: "service", reason: "apps package manifest" },
  ],
  signals: ["workspace manifest"],
  ambiguous: false,
};

describe("planDiscoveryPaths", () => {
  it("prefers workspace and representative package manifests", () => {
    const paths = planDiscoveryPaths([
      "README.md",
      "pnpm-workspace.yaml",
      "apps/web/package.json",
      "apps/api/package.json",
      "apps/web/src/app/page.tsx",
    ]);

    expect(paths.slice(0, 4)).toEqual([
      "pnpm-workspace.yaml",
      "README.md",
      "apps/api/package.json",
      "apps/web/package.json",
    ]);
  });
});

describe("planTargetedPaths", () => {
  it("expands representative files from known monorepo roots", () => {
    const paths = planTargetedPaths({
      allPaths: [
        "apps/web/package.json",
        "apps/web/src/app/page.tsx",
        "apps/api/package.json",
        "apps/api/src/index.ts",
      ],
      shape: monorepoShape,
      alreadyFetched: ["apps/web/package.json"],
      requestedPaths: ["apps/web", "apps/api/src/index.ts"],
    });

    expect(paths).toEqual([
      "apps/api/src/index.ts",
      "apps/web/src/app/page.tsx",
      "apps/api/package.json",
    ]);
  });
});
