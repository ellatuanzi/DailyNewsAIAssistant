import OpenAI from "openai";

export function createOpenAiClient(config) {
  return new OpenAI({ apiKey: config.openAiApiKey });
}
