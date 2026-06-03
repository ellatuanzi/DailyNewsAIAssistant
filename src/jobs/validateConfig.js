import { getConfig } from "../config.js";
import { log } from "../lib/logger.js";

export async function validateConfig() {
  const config = getConfig();
  log("Configuration validated.", {
    appEnv: config.appEnv,
    timezone: config.timezone,
    researchDir: config.researchDir,
    recipientEmail: config.recipientEmail,
    recipientEmails: config.recipientEmails,
    geminiModel: config.geminiModel,
    dailyBriefMaxPromptChars: config.dailyBriefMaxPromptChars,
    dailyBriefMaxOutputTokens: config.dailyBriefMaxOutputTokens,
    dailyBriefMaxLlmAttemptsPerDay: config.dailyBriefMaxLlmAttemptsPerDay,
    dailyBriefAllowAfterBudgetStop: config.dailyBriefAllowAfterBudgetStop
  });
}
