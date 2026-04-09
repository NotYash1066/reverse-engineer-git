import { describe, expect, it } from "vitest";
import { buildPrompt } from "@/lib/build-prompt";

describe("buildPrompt", () => {
  it("includes repository shape, coverage, assumptions, and ambiguities in the prompt context", () => {
    const prompt = buildPrompt({
      repo: {
        fullName: "acme/example",
        url: "https://github.com/acme/example",
        description: "Example repository",
      },
      stack: ["TypeScript", "Next.js"],
      appType: "Web application",
      keyFeatures: ["Repository analysis"],
      architectureNotes: ["Staged analysis pipeline"],
      evidence: ["README.md"],
      assumptions: ["The web app is the main user-facing surface."],
      ambiguities: [
        {
          topic: "backend runtime",
          reason: "No deployment config was fetched",
          severity: "medium",
          status: "open",
          relatedPaths: ["package.json"],
        },
      ],
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
    });

    expect(prompt).toContain("- Repository shape: single-app (root package.json)");
    expect(prompt).toContain("- Analysis coverage: representative; inspected roots: .");
    expect(prompt).toContain("Model-produced assumptions to preserve:");
    expect(prompt).toContain("Unresolved ambiguities to account for:");
    expect(prompt).toContain("- backend runtime: No deployment config was fetched");
  });
});
