import { LlmConfig, StructuredLlmResponse } from "@/lib/types";

export async function invokeGemini(
  config: LlmConfig,
  prompt: string
): Promise<StructuredLlmResponse> {
  if (!config.apiKey) {
    throw new Error("Missing API key for the selected LLM provider.");
  }

  const baseUrl = config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "You are a repository analysis engine. Return only valid JSON matching the requested schema.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to call the configured LLM provider.");
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("The LLM provider returned an empty response.");
  }

  return JSON.parse(text) as StructuredLlmResponse;
}
