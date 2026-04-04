import { invokeAnthropic } from "@/lib/llm/providers/anthropic";
import { invokeGemini } from "@/lib/llm/providers/gemini";
import { invokeOpenAiCompatible } from "@/lib/llm/providers/openai-compatible";
import { LlmConfig, LlmProviderId, StructuredLlmResponse } from "@/lib/types";

const SUPPORTED_PROVIDERS = new Set<LlmProviderId>([
  "anthropic",
  "openai-compatible",
  "gemini",
  "github-models",
]);

export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigError";
  }
}

export async function invokeStructuredLlm(
  config: LlmConfig,
  prompt: string
): Promise<StructuredLlmResponse> {
  switch (config.provider) {
    case "anthropic":
      return invokeAnthropic(config, prompt);
    case "gemini":
      return invokeGemini(config, prompt);
    case "github-models":
    case "openai-compatible":
      return invokeOpenAiCompatible(config, prompt);
    default:
      return assertNever(config.provider);
  }
}

export function resolveLlmConfig(): LlmConfig {
  const provider = (process.env.LLM_PROVIDER ?? "").trim();
  const model = (process.env.LLM_MODEL ?? "").trim();
  const apiKey = (process.env.LLM_API_KEY ?? "").trim();
  const baseUrl = process.env.LLM_BASE_URL?.trim();

  if (!provider || !model || !apiKey) {
    throw new LlmConfigError(
      "LLM is not configured. Set LLM_PROVIDER, LLM_MODEL, and LLM_API_KEY."
    );
  }

  if (!isLlmProviderId(provider)) {
    throw new LlmConfigError(
      `Unsupported LLM provider: ${provider}. Expected one of: ${Array.from(SUPPORTED_PROVIDERS).join(", ")}.`
    );
  }

  return {
    provider,
    model,
    apiKey,
    baseUrl,
  };
}

function isLlmProviderId(value: string): value is LlmProviderId {
  return SUPPORTED_PROVIDERS.has(value as LlmProviderId);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported LLM provider: ${String(value)}`);
}
