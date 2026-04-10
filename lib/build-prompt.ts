import type { RepoAnalysis } from "@/lib/types";

type PromptAnalysis = RepoAnalysis & {
  assumptions?: string[];
};

export function buildPrompt(analysis: PromptAnalysis): string {
  const assumptions = cleanItems(analysis.assumptions ?? []);
  const stack = cleanItems(analysis.stack);
  const features = cleanItems(analysis.keyFeatures);
  const architecture = cleanItems(analysis.architectureNotes);
  const projectBrief = buildProjectBrief(
    analysis.appType,
    analysis.repo.description ?? undefined,
    stack,
    features
  );

  const implementationPriorities = [
    "- Start with the core user journey and highest-signal product flows before adding polish.",
    "- Preserve the major module boundaries and technical decisions suggested by the repository.",
    stack.length > 0
      ? `- Stay close to the detected stack: ${stack.join(", ")}. Only substitute close equivalents when there is a clear reason.`
      : "- Stay close to the detected technical shape unless there is a clear reason to substitute a close equivalent.",
  ].join("\n");

  return [
    `Build a project inspired by ${analysis.repo.fullName} (${analysis.repo.url}) that recreates the same core product experience, technical shape, and implementation priorities without copying code verbatim.`,
    "",
    "Project brief",
    projectBrief,
    "",
    "What to build",
    toInstructionList(features, "Implement"),
    "",
    "Technical direction",
    toInstructionList(architecture, "Use"),
    "",
    "Implementation priorities",
    implementationPriorities,
    ...(assumptions.length > 0
      ? [
          "",
          "Assumptions",
          assumptions.map((assumption) => `- ${ensureSentence(assumption)}`).join("\n"),
        ]
      : []),
  ].join("\n");
}

function buildProjectBrief(
  appType: string,
  description: string | undefined,
  stack: string[],
  features: string[]
): string {
  const summary = description?.trim().length
    ? ensureSentence(description)
    : `This appears to be a ${appType.toLowerCase()} focused on ${summarizeFeatures(features)}.`;

  const technicalDirection = stack.length > 0
    ? `Recreate the same overall shape using ${stack.join(", ")} where those choices materially define the product and architecture.`
    : "Recreate the same overall product and architectural shape using close equivalents only when necessary.";

  return `${summary} ${technicalDirection}`;
}

function toInstructionList(items: string[], fallbackVerb: string): string {
  if (items.length === 0) {
    return "- Preserve the strongest signals from the repository and fill gaps conservatively.";
  }

  return items.map((item) => `- ${asInstruction(item, fallbackVerb)}`).join("\n");
}

function asInstruction(item: string, fallbackVerb: string): string {
  const normalized = ensureSentence(item);
  if (/^(build|implement|include|support|use|preserve|create|add|keep)\b/i.test(normalized)) {
    return normalized;
  }

  return `${fallbackVerb} ${lowercaseLeadingWord(normalized)}`;
}

function summarizeFeatures(features: string[]): string {
  if (features.length === 0) {
    return "the core experience suggested by the repository";
  }

  const [first, second] = features
    .slice(0, 2)
    .map((feature) => stripTrailingPunctuation(feature.trim()))
    .map(lowercaseLeadingWord);

  return second ? `${first} and ${second}` : first;
}

function cleanItems(items: string[]): string[] {
  return items.map((item) => item.trim()).filter((item) => item.length > 0);
}

function ensureSentence(value: string): string {
  const trimmed = value.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.!?]+$/, "");
}

function lowercaseLeadingWord(value: string): string {
  return /^[A-Z][a-z]/.test(value) ? `${value[0].toLowerCase()}${value.slice(1)}` : value;
}
