import { RepoAnalysis } from "@/lib/types";

export function buildPrompt(analysis: RepoAnalysis): string {
  const stack = analysis.stack.length > 0 ? analysis.stack.join(", ") : "Unknown stack";
  const features = toBulletList(analysis.keyFeatures);
  const architecture = toBulletList(analysis.architectureNotes);
  const evidence = toBulletList(analysis.evidence);

  return [
    `Reverse engineer and recreate a project inspired by ${analysis.repo.fullName} (${analysis.repo.url}).`,
    "",
    "Match the original project at a product and architecture level without copying code verbatim.",
    "",
    "Repository context:",
    `- Description: ${analysis.repo.description ?? "No description provided."}`,
    `- App type: ${analysis.appType}`,
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
    "Implementation instructions:",
    "- Recreate the product scope, folder structure, and technical choices suggested by the evidence above.",
    "- Preserve the likely user flows and module boundaries.",
    "- Use the detected stack unless there is a strong reason to substitute a close equivalent.",
    "- Start with the core path and highest-signal features before adding polish.",
    "- If repository details are ambiguous, make the smallest reasonable assumption and state it explicitly.",
    "",
    "Output format:",
    "1. Short project summary.",
    "2. Proposed architecture and folder layout.",
    "3. Step-by-step implementation plan.",
    "4. Key components, services, and data flows.",
    "5. Final build notes and assumptions.",
  ].join("\n");
}

function toBulletList(items: string[]): string {
  if (items.length === 0) {
    return "- None identified confidently from the available public signals.";
  }

  return items.map((item) => `- ${item}`).join("\n");
}
