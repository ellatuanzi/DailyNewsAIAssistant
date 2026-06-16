import { getConfig } from "../config.js";
import { log } from "../lib/logger.js";

export async function validateConfig() {
  const config = getConfig();
  log("Configuration validated.", {
    appEnv: config.appEnv,
    timezone: config.timezone,
    researchDir: config.researchDir,
    stateDir: config.stateDir,
    emailProvider: config.emailProvider,
    emailSender: config.emailSender,
    stateProvider: config.stateProvider,
    upstashRedisConfigured:
      config.stateProvider === "upstash-redis"
        ? Boolean(config.upstashRedisRestUrl && config.upstashRedisRestToken)
        : false,
    recipientEmail: config.recipientEmail,
    recipientEmails: config.recipientEmails,
    geminiModel: config.geminiModel,
    dailyBriefMaxPromptChars: config.dailyBriefMaxPromptChars,
    dailyBriefMaxOutputTokens: config.dailyBriefMaxOutputTokens,
    dailyBriefAllowAfterBudgetStop: config.dailyBriefAllowAfterBudgetStop
  });
}
