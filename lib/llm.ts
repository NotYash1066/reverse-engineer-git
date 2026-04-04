import { invokeAnthropic } from "@/lib/llm/providers/anthropic";
import { invokeGemini } from "@/lib/llm/providers/gemini";
import { invokeOpenAiCompatible } from "@/lib/llm/providers/openai-compatible";
import { LlmConfig, LlmProviderId, StructuredLlmResponse } from "@/lib/types";

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

export function resolveLlmConfig(): LlmConfig | null {
  const provider = (process.env.LLM_PROVIDER ?? "").trim() as LlmProviderId | "";
  const model = (process.env.LLM_MODEL ?? "").trim();

  if (!provider || !model) {
    return null;
  }

  return {
    provider,
    model,
    apiKey: process.env.LLM_API_KEY?.trim(),
    baseUrl: process.env.LLM_BASE_URL?.trim(),
  };
}

function assertNever(value: never): never {
  throw new Error(`Unsupported LLM provider: ${String(value)}`);
}
