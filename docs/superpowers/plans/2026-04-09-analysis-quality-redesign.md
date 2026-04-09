# Analysis Quality Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current seed-plus-loop analyzer with a staged analysis pipeline that performs better on both ordinary repositories and large or ambiguous monorepos while preserving the existing top-level API contract.

**Architecture:** Keep `app/api/analyze/route.ts` as the entry point, but move analysis quality decisions into explicit modules for repository shaping, retrieval planning, scoring, and staged orchestration. Preserve `normalizedRepo`, `summary`, `prompt`, and `analysisMeta` at the response top level while extending `analysisMeta` additively with repo-shape, coverage, and stage summaries.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Vitest, ESLint

---

## Files to create or modify

- Create: `vitest.config.ts` — test runner config with `@/*` alias support
- Create: `tests/fixtures/repo-snapshots.ts` — deterministic repository snapshot fixtures
- Create: `tests/smoke/basic.test.ts` — smoke test proving the harness works
- Create: `tests/lib/repo-shape.test.ts` — unit tests for repository classification
- Create: `tests/lib/retrieval-planner.test.ts` — unit tests for staged file selection
- Create: `tests/lib/analysis-scoring.test.ts` — unit tests for confidence and coverage scoring
- Create: `tests/lib/analysis-loop.test.ts` — staged orchestration tests with injected dependencies
- Create: `tests/app/api/analyze/route.test.ts` — API contract tests for `/api/analyze`
- Create: `lib/repo-shape.ts` — repository classification logic
- Create: `lib/retrieval-planner.ts` — discovery and targeted retrieval planning
- Create: `lib/analysis-scoring.ts` — coverage and confidence scoring helpers
- Modify: `package.json` — add `test` script and Vitest dev dependency
- Modify: `lib/types.ts` — add repo-shape, coverage, and stage summary contracts
- Modify: `lib/github.ts` — use discovery-aware initial path selection and return richer snapshot data
- Modify: `lib/analyze-repo.ts` — consume repo-shape signals during heuristic synthesis
- Modify: `lib/analysis-loop.ts` — refactor into explicit staged orchestration with dependency injection
- Modify: `lib/build-prompt.ts` — incorporate stronger evidence, assumptions, and coverage-aware wording
- Modify: `app/api/analyze/route.ts` — preserve response shape while returning additive metadata

## Docs to keep open while implementing

- `docs/superpowers/specs/2026-04-09-analysis-quality-redesign-design.md`
- `CLAUDE.md`
- `AGENTS.md`

### Task 1: Add a test harness before touching analysis logic

**Files:**
- Create: `tests/smoke/basic.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing smoke test**

```ts
// tests/smoke/basic.test.ts
import { describe, expect, it } from "vitest";

describe("test harness", () => {
  it("runs a basic assertion", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Run the smoke test to verify it fails before the harness exists**

Run: `npm run test -- --run tests/smoke/basic.test.ts`
Expected: FAIL with `Missing script: "test"`

- [ ] **Step 3: Add the minimal Vitest setup**

```json
// package.json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest"
  }
}
```

```ts
// vitest.config.ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

Run: `npm install -D vitest`

- [ ] **Step 4: Run the smoke test again to verify the harness works**

Run: `npm run test -- --run tests/smoke/basic.test.ts`
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/smoke/basic.test.ts
git commit -m "test: add vitest harness for analysis pipeline"
```

### Task 2: Add repo-shape types and classification

**Files:**
- Create: `tests/fixtures/repo-snapshots.ts`
- Create: `tests/lib/repo-shape.test.ts`
- Create: `lib/repo-shape.ts`
- Modify: `lib/types.ts`

- [ ] **Step 1: Write failing repo-shape tests**

```ts
// tests/fixtures/repo-snapshots.ts
import { RepoSnapshot } from "@/lib/types";

export function makeRepoSnapshot(overrides: Partial<RepoSnapshot> = {}): RepoSnapshot {
  return {
    repo: {
      full_name: "acme/example",
      name: "example",
      description: "Example repository",
      private: false,
      html_url: "https://github.com/acme/example",
      default_branch: "main",
      language: "TypeScript",
      stargazers_count: 0,
      forks_count: 0,
      open_issues_count: 0,
      topics: [],
      homepage: null,
      license: null,
    },
    rootEntries: [],
    allPaths: [],
    files: [],
    ...overrides,
  };
}
```

```ts
// tests/lib/repo-shape.test.ts
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
```

- [ ] **Step 2: Run the repo-shape tests to verify they fail**

Run: `npm run test -- --run tests/lib/repo-shape.test.ts`
Expected: FAIL with `Cannot find module '@/lib/repo-shape'` and missing repo-shape types

- [ ] **Step 3: Add the repo-shape contracts and classifier**

```ts
// lib/types.ts
export type RepoShapeKind =
  | "single-app"
  | "service"
  | "library"
  | "monorepo"
  | "mixed"
  | "docs-heavy";

export type RepoShapeRoot = {
  path: string;
  kind: "workspace" | "app" | "service" | "package";
  reason: string;
};

export type RepoShape = {
  kind: RepoShapeKind;
  roots: RepoShapeRoot[];
  signals: string[];
  ambiguous: boolean;
};
```

```ts
// lib/repo-shape.ts
import { RepoShape, RepoShapeRoot, RepoSnapshot } from "@/lib/types";

function makeRoot(path: string, kind: RepoShapeRoot["kind"], reason: string): RepoShapeRoot {
  return { path, kind, reason };
}

export function classifyRepoShape(snapshot: RepoSnapshot): RepoShape {
  const pathSet = new Set(snapshot.allPaths);
  const roots: RepoShapeRoot[] = [];
  const signals: string[] = [];

  if (pathSet.has("pnpm-workspace.yaml")) {
    signals.push("workspace manifest");
  }

  for (const path of snapshot.allPaths) {
    const match = path.match(/^(apps|packages|services)\/([^/]+)\/package\.json$/);
    if (match) {
      const [, bucket, name] = match;
      const kind = bucket === "services" ? "service" : bucket === "packages" ? "package" : "app";
      roots.push(makeRoot(`${bucket}/${name}`, kind, `${bucket} package manifest`));
    }
  }

  if (roots.length > 1 || pathSet.has("pnpm-workspace.yaml")) {
    return {
      kind: "monorepo",
      roots,
      signals: [...signals, `${roots.length} package roots`],
      ambiguous: false,
    };
  }

  if (pathSet.has("package.json") && (pathSet.has("next.config.ts") || pathSet.has("app/page.tsx"))) {
    return {
      kind: "single-app",
      roots: [makeRoot(".", "app", "root app manifests")],
      signals: ["root package.json", "root web app signals"],
      ambiguous: false,
    };
  }

  if (pathSet.has("Cargo.toml") && (pathSet.has("frontend/package.json") || pathSet.has("backend/package.json"))) {
    return {
      kind: "mixed",
      roots: [
        makeRoot("frontend", "app", "frontend package manifest"),
        makeRoot("backend", "service", "backend package manifest"),
      ],
      signals: ["multiple stack roots"],
      ambiguous: true,
    };
  }

  return {
    kind: "service",
    roots: [makeRoot(".", "service", "default repository root")],
    signals: ["fallback classification"],
    ambiguous: true,
  };
}
```

- [ ] **Step 4: Run the repo-shape tests again**

Run: `npm run test -- --run tests/lib/repo-shape.test.ts`
Expected: PASS with `3 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/repo-shape.ts tests/fixtures/repo-snapshots.ts tests/lib/repo-shape.test.ts
git commit -m "feat: classify repository shape before retrieval"
```

### Task 3: Add stage-aware retrieval planning

**Files:**
- Create: `lib/retrieval-planner.ts`
- Create: `tests/lib/retrieval-planner.test.ts`
- Modify: `lib/github.ts`

- [ ] **Step 1: Write failing retrieval-planner tests**

```ts
// tests/lib/retrieval-planner.test.ts
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
```

- [ ] **Step 2: Run the retrieval-planner tests to verify they fail**

Run: `npm run test -- --run tests/lib/retrieval-planner.test.ts`
Expected: FAIL with `Cannot find module '@/lib/retrieval-planner'`

- [ ] **Step 3: Implement discovery and targeted retrieval planning**

```ts
// lib/retrieval-planner.ts
import { RepoShape } from "@/lib/types";

const DISCOVERY_PATTERNS = [
  /^pnpm-workspace\.yaml$/,
  /^README(\.[a-z0-9]+)?$/i,
  /^package\.json$/,
  /^(apps|packages|services)\/[^/]+\/package\.json$/,
  /^(apps|packages|services)\/[^/]+\/(tsconfig\.json|pyproject\.toml|Cargo\.toml|go\.mod)$/,
];

function scoreDiscoveryPath(path: string): number {
  if (path === "pnpm-workspace.yaml") return 120;
  if (/^README/i.test(path)) return 110;
  if (path === "package.json") return 100;
  if (/^(apps|packages|services)\/[^/]+\/package\.json$/.test(path)) return 90;
  return 40;
}

export function planDiscoveryPaths(allPaths: string[]): string[] {
  return allPaths
    .filter((path) => DISCOVERY_PATTERNS.some((pattern) => pattern.test(path)))
    .sort((left, right) => scoreDiscoveryPath(right) - scoreDiscoveryPath(left) || left.localeCompare(right))
    .slice(0, 18);
}

export function planTargetedPaths(input: {
  allPaths: string[];
  shape: RepoShape;
  alreadyFetched: string[];
  requestedPaths: string[];
}): string[] {
  const fetched = new Set(input.alreadyFetched);
  const ordered = new Set<string>();

  for (const requestedPath of input.requestedPaths) {
    if (input.allPaths.includes(requestedPath) && !fetched.has(requestedPath)) {
      ordered.add(requestedPath);
      fetched.add(requestedPath);
      continue;
    }

    const prefix = requestedPath.endsWith("/") ? requestedPath : `${requestedPath}/`;
    for (const path of input.allPaths) {
      if (!path.startsWith(prefix) || fetched.has(path)) continue;
      if (/package\.json$|tsconfig\.json$|page\.tsx$|index\.ts$/.test(path)) {
        ordered.add(path);
        fetched.add(path);
      }
    }
  }

  for (const root of input.shape.roots) {
    for (const path of input.allPaths) {
      if (!path.startsWith(root.path) || fetched.has(path)) continue;
      if (/package\.json$|page\.tsx$|index\.ts$/.test(path)) {
        ordered.add(path);
        fetched.add(path);
        break;
      }
    }
  }

  return [...ordered].slice(0, 12);
}
```

```ts
// lib/github.ts
import { planDiscoveryPaths } from "@/lib/retrieval-planner";

export function selectInitialContextPaths(allPaths: string[]): string[] {
  return planDiscoveryPaths(allPaths);
}
```

- [ ] **Step 4: Run the retrieval-planner tests again**

Run: `npm run test -- --run tests/lib/retrieval-planner.test.ts`
Expected: PASS with `2 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/retrieval-planner.ts lib/github.ts tests/lib/retrieval-planner.test.ts
git commit -m "feat: add retrieval planner for staged analysis"
```

### Task 4: Score coverage and confidence explicitly

**Files:**
- Create: `lib/analysis-scoring.ts`
- Create: `tests/lib/analysis-scoring.test.ts`
- Modify: `lib/types.ts`

- [ ] **Step 1: Write failing scoring tests**

```ts
// tests/lib/analysis-scoring.test.ts
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
```

- [ ] **Step 2: Run the scoring tests to verify they fail**

Run: `npm run test -- --run tests/lib/analysis-scoring.test.ts`
Expected: FAIL with `Cannot find module '@/lib/analysis-scoring'`

- [ ] **Step 3: Add coverage and confidence scoring**

```ts
// lib/types.ts
export type AnalysisCoverage = {
  status: "narrow" | "representative" | "broad";
  inspectedRoots: string[];
  representativeRoots: string[];
  fileCount: number;
  bytesFetched: number;
  gaps: string[];
};

export type AnalysisStageSummary = {
  stage: "discovery" | "classification" | "targeted_retrieval" | "synthesis" | "scoring";
  requestedPaths: string[];
  fetchedPaths: string[];
  notes: string[];
};
```

```ts
// lib/analysis-scoring.ts
import { AnalysisAmbiguity, AnalysisConfidence, AnalysisCoverage, RepoShape } from "@/lib/types";

export function buildCoverage(input: {
  shape: RepoShape;
  fetchedPaths: string[];
  bytesFetched: number;
}): AnalysisCoverage {
  const inspectedRoots = input.shape.roots
    .map((root) => root.path)
    .filter((root) => input.fetchedPaths.some((path) => root === "." ? true : path.startsWith(root)));

  const missingRoots = input.shape.roots
    .map((root) => root.path)
    .filter((root) => !inspectedRoots.includes(root));

  const status =
    inspectedRoots.length === 0
      ? "narrow"
      : missingRoots.length === 0
        ? inspectedRoots.length > 2 ? "broad" : "representative"
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
  const coverageBonus = input.coverage.status === "broad" ? 0.15 : input.coverage.status === "representative" ? 0.08 : -0.08;
  const ambiguityPenalty = openHigh * 0.15;
  const assumptionPenalty = Math.min(input.assumptions.length * 0.03, 0.12);
  const overall = Math.max(0.2, Math.min(0.95, 0.72 + coverageBonus - ambiguityPenalty - assumptionPenalty));

  return {
    overall,
    stack: Math.max(0.2, overall + 0.05),
    appType: overall,
    features: Math.max(0.2, overall - 0.03),
    architecture: Math.max(0.2, overall - 0.08),
  };
}
```

- [ ] **Step 4: Run the scoring tests again**

Run: `npm run test -- --run tests/lib/analysis-scoring.test.ts`
Expected: PASS with `2 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/analysis-scoring.ts tests/lib/analysis-scoring.test.ts
git commit -m "feat: score analysis coverage and confidence explicitly"
```

### Task 5: Refactor the analyzer into explicit stages

**Files:**
- Create: `tests/lib/analysis-loop.test.ts`
- Modify: `lib/analysis-loop.ts`
- Modify: `lib/analyze-repo.ts`
- Modify: `lib/github.ts`

- [ ] **Step 1: Write a failing staged-analysis test**

```ts
// tests/lib/analysis-loop.test.ts
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
});
```

- [ ] **Step 2: Run the staged-analysis test to verify it fails**

Run: `npm run test -- --run tests/lib/analysis-loop.test.ts`
Expected: FAIL because `repoShape`, `coverage`, `stageSummaries`, and dependency injection do not exist yet

- [ ] **Step 3: Refactor `runAnalysisLoop` into staged orchestration**

```ts
// lib/analysis-loop.ts
import { buildPrompt } from "@/lib/build-prompt";
import { buildCoverage, computeConfidence } from "@/lib/analysis-scoring";
import { measureFiles } from "@/lib/context-selection";
import { fetchRepoFiles } from "@/lib/github";
import { classifyRepoShape } from "@/lib/repo-shape";
import { planTargetedPaths } from "@/lib/retrieval-planner";
import { invokeStructuredLlm } from "@/lib/llm";
import {
  AnalysisLoopInput,
  AnalysisLoopResult,
  AnalysisStageSummary,
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
  const repoShape = classifyRepoShape(input.snapshot);
  const fetchedFiles = [...input.snapshot.files];
  const fetchedPaths = fetchedFiles.map((file) => file.path);
  const stageSummaries: AnalysisStageSummary[] = [
    {
      stage: "discovery",
      requestedPaths: [],
      fetchedPaths,
      notes: ["Loaded initial repository snapshot"],
    },
    {
      stage: "classification",
      requestedPaths: [],
      fetchedPaths: [],
      notes: [`Classified repository as ${repoShape.kind}`],
    },
  ];

  let summary = {
    stack: input.seed.stack,
    appType: input.seed.appType,
    keyFeatures: input.seed.keyFeatures,
    architectureNotes: [...input.seed.architectureNotes, `Repository shape: ${repoShape.kind}`],
    evidence: input.seed.evidence,
  };
  let ambiguities: StructuredLlmResponse["ambiguities"] = [];
  let assumptions: string[] = [];

  for (let index = 0; index < input.budget.maxIterations; index += 1) {
    const llmResponse = await invokeLlm(input.llmConfig, JSON.stringify({
      repo: input.seed.repo.fullName,
      repoShape,
      summary,
      ambiguities,
      assumptions,
      fetchedFiles,
    }));

    const nextPaths = planTargetedPaths({
      allPaths: input.snapshot.allPaths,
      shape: repoShape,
      alreadyFetched: fetchedPaths,
      requestedPaths: llmResponse.contextRequests.map((request) => request.path),
    });

    const nextFiles = await fetchFiles(input.snapshot.repo.full_name, nextPaths);
    fetchedFiles.push(...nextFiles);
    fetchedPaths.push(...nextFiles.map((file) => file.path));
    summary = llmResponse.summary;
    ambiguities = llmResponse.ambiguities;
    assumptions = llmResponse.assumptions;

    stageSummaries.push({
      stage: "targeted_retrieval",
      requestedPaths: llmResponse.contextRequests.map((request) => request.path),
      fetchedPaths: nextFiles.map((file) => file.path),
      notes: llmResponse.notes,
    });

    if (!llmResponse.continueAnalysis || nextFiles.length === 0) {
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
  const confidence = computeConfidence({ coverage, ambiguities, assumptions });

  stageSummaries.push({
    stage: "scoring",
    requestedPaths: [],
    fetchedPaths: [],
    notes: [`Coverage status: ${coverage.status}`],
  });

  return {
    summary,
    meta: {
      provider: input.llmConfig.provider,
      model: input.llmConfig.model,
      stopReason: confidence.overall >= input.budget.confidenceThreshold ? "confidence_reached" : "model_completed",
      confidence,
      ambiguities,
      iterations: [],
      budget: {
        iterations: stageSummaries.filter((stage) => stage.stage === "targeted_retrieval").length,
        filesFetched: fetchedFiles.length,
        bytesFetched: measureFiles(fetchedFiles),
      },
      assumptions,
      repoShape,
      coverage,
      stageSummaries,
    },
  };
}

export function buildFinalPrompt(result: AnalysisLoopResult, analysis: { repo: { fullName: string; url: string; description: string | null } }) {
  return buildPrompt({
    repo: analysis.repo,
    stack: result.summary.stack,
    appType: result.summary.appType,
    keyFeatures: result.summary.keyFeatures,
    architectureNotes: result.summary.architectureNotes,
    evidence: result.summary.evidence,
    assumptions: result.meta.assumptions,
    repoShape: result.meta.repoShape,
    coverage: result.meta.coverage,
  });
}
```

```ts
// lib/analyze-repo.ts
import { classifyRepoShape } from "@/lib/repo-shape";

export function analyzeRepo(snapshot: RepoSnapshot): RepoAnalysis {
  const repoShape = classifyRepoShape(snapshot);

  return {
    repo: {
      fullName: snapshot.repo.full_name,
      url: snapshot.repo.html_url,
      description: snapshot.repo.description,
    },
    stack: detectStack(snapshot),
    appType: repoShape.kind === "monorepo" ? "Monorepo software project" : detectAppType(snapshot),
    keyFeatures: detectKeyFeatures(snapshot),
    architectureNotes: [
      `Repository shape classified as ${repoShape.kind}.`,
      ...detectArchitectureNotes(snapshot),
    ],
    evidence: collectEvidence(snapshot),
  };
}
```

- [ ] **Step 4: Run the staged-analysis test again**

Run: `npm run test -- --run tests/lib/analysis-loop.test.ts`
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add lib/analysis-loop.ts lib/analyze-repo.ts lib/github.ts tests/lib/analysis-loop.test.ts
git commit -m "feat: refactor analysis loop into staged pipeline"
```

### Task 6: Preserve the API contract while enriching prompt and metadata

**Files:**
- Create: `tests/app/api/analyze/route.test.ts`
- Modify: `lib/types.ts`
- Modify: `lib/build-prompt.ts`
- Modify: `app/api/analyze/route.ts`

- [ ] **Step 1: Write a failing API contract test**

```ts
// tests/app/api/analyze/route.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/parse-repo-input", () => ({
  parseRepoInput: () => ({ owner: "acme", repo: "example", normalized: "acme/example", url: "https://github.com/acme/example" }),
}));

vi.mock("@/lib/llm", () => ({
  LlmConfigError: class LlmConfigError extends Error {},
  resolveLlmConfig: () => ({ provider: "openai-compatible", model: "test-model", apiKey: "test-key" }),
}));

vi.mock("@/lib/github", () => ({
  fetchRepoSnapshot: async () => ({
    repo: { full_name: "acme/example", html_url: "https://github.com/acme/example", description: "Example", default_branch: "main", language: "TypeScript", topics: [], license: null },
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
      repoShape: { kind: "single-app", roots: [{ path: ".", kind: "app", reason: "root app manifests" }], signals: ["root package.json"], ambiguous: false },
      coverage: { status: "representative", inspectedRoots: ["."], representativeRoots: ["."], fileCount: 4, bytesFetched: 1234, gaps: [] },
      stageSummaries: [],
    },
  }),
  buildFinalPrompt: () => "reverse-engineering prompt",
}));

import { POST } from "@/app/api/analyze/route";

describe("POST /api/analyze", () => {
  it("returns the existing top-level shape plus additive analysis metadata", async () => {
    const response = await POST(new Request("http://localhost/api/analyze", {
      method: "POST",
      body: JSON.stringify({ repo: "acme/example" }),
      headers: { "Content-Type": "application/json" },
    }));

    const json = await response.json();

    expect(json.normalizedRepo).toBe("acme/example");
    expect(json.summary.appType).toBe("Web application");
    expect(json.prompt).toBe("reverse-engineering prompt");
    expect(json.analysisMeta.repoShape.kind).toBe("single-app");
    expect(json.analysisMeta.coverage.status).toBe("representative");
  });
});
```

- [ ] **Step 2: Run the API contract test to verify it fails**

Run: `npm run test -- --run tests/app/api/analyze/route.test.ts`
Expected: FAIL because `analysisMeta.repoShape`, `coverage`, and `stageSummaries` are not typed and/or returned yet

- [ ] **Step 3: Extend metadata typing and prompt generation without changing the top-level response**

```ts
// lib/types.ts
export type AnalysisMeta = {
  provider: LlmProviderId;
  model: string;
  stopReason: AnalysisStopReason;
  confidence: AnalysisConfidence;
  ambiguities: AnalysisAmbiguity[];
  iterations: AnalysisIteration[];
  budget: AnalysisBudgetUsage;
  assumptions: string[];
  repoShape: RepoShape;
  coverage: AnalysisCoverage;
  stageSummaries: AnalysisStageSummary[];
};
```

```ts
// lib/build-prompt.ts
import { AnalysisCoverage, RepoAnalysis, RepoShape } from "@/lib/types";

type PromptAnalysis = RepoAnalysis & {
  assumptions?: string[];
  repoShape?: RepoShape;
  coverage?: AnalysisCoverage;
};

export function buildPrompt(analysis: PromptAnalysis): string {
  const assumptions = (analysis.assumptions ?? []).filter((item) => item.trim().length > 0);
  const repoShape = analysis.repoShape ? `${analysis.repoShape.kind} (${analysis.repoShape.signals.join(", ") || "shape signals unavailable"})` : "Unknown";
  const coverage = analysis.coverage
    ? `${analysis.coverage.status}; inspected roots: ${analysis.coverage.inspectedRoots.join(", ") || "none"}`
    : "Coverage unknown";

  return [
    `Reverse engineer and recreate a project inspired by ${analysis.repo.fullName} (${analysis.repo.url}).`,
    "",
    "Repository context:",
    `- Description: ${analysis.repo.description ?? "No description provided."}`,
    `- App type: ${analysis.appType}`,
    `- Repository shape: ${repoShape}`,
    `- Analysis coverage: ${coverage}`,
    "",
    "Likely major features to reproduce:",
    ...analysis.keyFeatures.map((item) => `- ${item}`),
    "",
    "Architecture and implementation clues:",
    ...analysis.architectureNotes.map((item) => `- ${item}`),
    "",
    "Observed evidence from the public repository:",
    ...analysis.evidence.map((item) => `- ${item}`),
    ...(assumptions.length > 0
      ? ["", "Model-produced assumptions to preserve:", ...assumptions.map((item) => `- ${item}`)]
      : []),
  ].join("\n");
}
```

```ts
// app/api/analyze/route.ts
const response: AnalyzeRepoResponse = {
  normalizedRepo: parsed.normalized,
  summary: loopResult.summary,
  prompt: buildFinalPrompt(loopResult, seed),
  analysisMeta: loopResult.meta,
};
```

- [ ] **Step 4: Run the API contract test again**

Run: `npm run test -- --run tests/app/api/analyze/route.test.ts`
Expected: PASS with `1 passed`

- [ ] **Step 5: Commit**

```bash
git add app/api/analyze/route.ts lib/types.ts lib/build-prompt.ts tests/app/api/analyze/route.test.ts
git commit -m "feat: enrich analysis metadata and prompt output"
```

### Task 7: Verify the whole redesign end to end

**Files:**
- Modify: `package.json` (only if a test script name or command needs a final adjustment)
- Test: `tests/**/*.test.ts`

- [ ] **Step 1: Run the full test suite**

Run: `npm run test -- --run`
Expected: PASS with all smoke, unit, orchestration, and route tests green

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS with no ESLint errors

- [ ] **Step 3: Run a production build**

Run: `npm run build`
Expected: PASS with a successful Next.js production build

- [ ] **Step 4: Run a manual API smoke check with the dev server**

Run in one terminal: `npm run dev`

Run in a second terminal:

```bash
curl -sS -X POST http://localhost:3000/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{"repo":"vercel/swr"}'
```

Expected: JSON with non-empty `prompt`, non-empty `summary`, and additive `analysisMeta.repoShape`, `analysisMeta.coverage`, and `analysisMeta.stageSummaries`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app/api/analyze/route.ts lib tests
git commit -m "chore: verify staged analysis pipeline"
```

## Self-review checklist

- **Spec coverage:**
  - staged architecture -> Tasks 2-6
  - repo classification -> Task 2
  - targeted retrieval -> Task 3
  - explicit scoring and coverage -> Task 4
  - staged coordinator and stop behavior -> Task 5
  - additive API metadata and stronger prompt output -> Task 6
  - deterministic tests and final verification -> Tasks 1 and 7
- **Placeholder scan:** no `TBD`, `TODO`, or undefined “handle edge cases” steps remain.
- **Type consistency:** the plan consistently uses `RepoShape`, `AnalysisCoverage`, and `AnalysisStageSummary` across types, scoring, orchestration, and API output.
