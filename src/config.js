import path from "node:path";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name, defaultValue = undefined) {
  const value = process.env[name];
  return value == null || value === "" ? defaultValue : value;
}

function booleanFlag(value, defaultValue = false) {
  if (value == null || value === "") return defaultValue;
  return value === "true";
}

export function getConfig() {
  return {
    appEnv: process.env.APP_ENV || "development",
    timezone: process.env.TIMEZONE || "America/Los_Angeles",
    researchDir: process.env.RESEARCH_DIR || path.resolve(process.cwd(), "research"),
    geminiApiKey: optional("GEMINI_API_KEY"),
    geminiModel: optional("GEMINI_MODEL", "gemini-2.5-flash"),
    geminiTemperature: Number(optional("GEMINI_TEMPERATURE", "0.2")),
    dailyBriefMaxPromptChars: Number(process.env.DAILY_BRIEF_MAX_PROMPT_CHARS || "45000"),
    dailyBriefMaxOutputTokens: Number(process.env.DAILY_BRIEF_MAX_OUTPUT_TOKENS || "4000"),
    dailyBriefMaxLlmAttemptsPerDay: Number(process.env.DAILY_BRIEF_MAX_LLM_ATTEMPTS_PER_DAY || "1"),
    dailyBriefAllowAfterBudgetStop: booleanFlag(
      process.env.DAILY_BRIEF_ALLOW_AFTER_BUDGET_STOP,
      false
    ),
    gmailClientId: required("GMAIL_CLIENT_ID"),
    gmailClientSecret: required("GMAIL_CLIENT_SECRET"),
    gmailRefreshToken: required("GMAIL_REFRESH_TOKEN"),
    gmailSender: required("GMAIL_SENDER"),
    recipientEmail: required("RECIPIENT_EMAIL"),
    pendingSyncToEmail: process.env.PENDING_SYNC_TO_EMAIL || required("RECIPIENT_EMAIL")
  };
}
