import { describe, expect, it } from "vitest";
import { classifyRepoShape } from "@/lib/repo-shape";
import { makeRepoSnapshot } from "../fixtures/repo-snapshots";

describe("classifyRepoShape", () => {
  it("classifies a monorepo from workspace signals", () => {
    const snapshot = makeRepoSnapshot({
      allPaths: [
        "package.json",
        "pnpm-workspace.yaml",
        "apps/web/package.json",
        "apps/api/package.json",
      ],
    });

    const result = classifyRepoShape(snapshot);

    expect(result.kind).toBe("monorepo");
    expect(result.roots.map((root) => root.path)).toEqual(["apps/web", "apps/api"]);
    expect(result.ambiguous).toBe(false);
  });

  it("classifies a single app from root manifests", () => {
    const snapshot = makeRepoSnapshot({
      allPaths: ["package.json", "next.config.ts", "app/page.tsx"],
    });

    const result = classifyRepoShape(snapshot);

    expect(result.kind).toBe("single-app");
    expect(result.roots).toEqual([{ path: ".", kind: "app", reason: "root app manifests" }]);
  });

  it("marks mixed repos as ambiguous when multiple structures compete", () => {
    const snapshot = makeRepoSnapshot({
      allPaths: [
        "package.json",
        "backend/package.json",
        "frontend/package.json",
        "Cargo.toml",
      ],
    });

    const result = classifyRepoShape(snapshot);

    expect(result.kind).toBe("mixed");
    expect(result.ambiguous).toBe(true);
  });
});
