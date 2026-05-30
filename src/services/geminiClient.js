function extractTextFromResponse(data) {
  const candidates = data?.candidates || [];
  const texts = [];

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];

    for (const part of parts) {
      if (typeof part?.text === "string" && part.text.trim()) {
        texts.push(part.text.trim());
      }
    }
  }

  return texts.join("\n\n").trim();
}

function isBudgetStopError(status, message) {
  const normalized = `${message || ""}`.toLowerCase();
  return (
    status === 429 ||
    normalized.includes("quota") ||
    normalized.includes("billing") ||
    normalized.includes("resource exhausted") ||
    normalized.includes("rate limit exceeded")
  );
}

export function createGeminiClient(config) {
  return {
    async generateText(prompt) {
      const url = new URL(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`
      );
      url.searchParams.set("key", config.geminiApiKey);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: config.geminiTemperature,
            maxOutputTokens: config.dailyBriefMaxOutputTokens
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const message =
          data?.error?.message ||
          `Gemini request failed with status ${response.status}.`;
        const error = new Error(message);
        error.status = response.status;
        error.provider = "gemini";
        error.details = data?.error || data;
        error.budgetStop = isBudgetStopError(response.status, message);
        throw error;
      }

      const text = extractTextFromResponse(data);

      if (!text) {
        throw new Error("Gemini returned an empty daily brief body.");
      }

      return text;
    }
  };
}
