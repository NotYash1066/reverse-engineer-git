import { LlmConfig, StructuredLlmResponse } from "@/lib/types";

export async function invokeOpenAiCompatible(
  config: LlmConfig,
  prompt: string
): Promise<StructuredLlmResponse> {
  if (!config.apiKey) {
    throw new Error("Missing API key for the selected LLM provider.");
  }

  const baseUrl = config.baseUrl ?? "https://openrouter.ai/api/v1";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "You are a repository analysis engine. Return only valid JSON matching the requested schema.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      response_format: {
        type: "json_object",
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to call the configured LLM provider.");
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("The LLM provider returned an empty response.");
  }

  return JSON.parse(content) as StructuredLlmResponse;
}
