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

function extractGroundingMetadata(data) {
  const candidates = data?.candidates || [];
  const chunks = [];
  const queries = [];

  for (const candidate of candidates) {
    const metadata = candidate?.groundingMetadata;
    const groundingChunks = metadata?.groundingChunks || [];
    const webQueries = metadata?.webSearchQueries || [];

    for (const query of webQueries) {
      if (typeof query === "string" && query.trim()) {
        queries.push(query.trim());
      }
    }

    for (const chunk of groundingChunks) {
      const web = chunk?.web;
      if (!web?.uri) continue;
      chunks.push({
        title: web.title || web.uri,
        uri: web.uri
      });
    }
  }

  return {
    queries,
    chunks
  };
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
    async generateText(prompt, options = {}) {
      const grounded = options.grounded === true;
      const requireGrounding = options.requireGrounding === true;
      const url = new URL(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`
      );
      url.searchParams.set("key", config.geminiApiKey);

      const requestBody = {
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
      };

      if (grounded) {
        requestBody.tools = [{ google_search: {} }];
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
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
      const grounding = extractGroundingMetadata(data);

      if (!text) {
        throw new Error("Gemini returned an empty daily brief body.");
      }

      if (requireGrounding && grounding.chunks.length === 0) {
        const error = new Error(
          "Gemini returned a daily brief without grounding sources; refusing to send unverifiable news."
        );
        error.code = "missing_grounding";
        error.provider = "gemini";
        error.details = {
          grounding
        };
        throw error;
      }

      return {
        text,
        grounding
      };
    }
  };
}
