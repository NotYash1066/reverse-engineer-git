import { LlmConfig, StructuredLlmResponse } from "@/lib/types";

export async function invokeAnthropic(
  config: LlmConfig,
  prompt: string
): Promise<StructuredLlmResponse> {
  if (!config.apiKey) {
    throw new Error("Missing API key for the selected LLM provider.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2000,
      temperature: 0.2,
      system:
        "You are a repository analysis engine. Return only valid JSON matching the requested schema.",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to call the configured LLM provider.");
  }

  const data = (await response.json()) as {
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  };

  const text = data.content?.find((item) => item.type === "text")?.text;
  if (!text) {
    throw new Error("The LLM provider returned an empty response.");
  }

  return JSON.parse(text) as StructuredLlmResponse;
}
