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

function parseEmailList(value) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getConfig() {
  const recipientEmails = parseEmailList(
    optional("RECIPIENT_EMAILS", process.env.RECIPIENT_EMAIL || "")
  );

  if (recipientEmails.length === 0) {
    throw new Error("Missing required environment variable: RECIPIENT_EMAILS or RECIPIENT_EMAIL");
  }

  return {
    appEnv: process.env.APP_ENV || "development",
    timezone: process.env.TIMEZONE || "America/Los_Angeles",
    researchDir: process.env.RESEARCH_DIR || path.resolve(process.cwd(), "research"),
    geminiApiKey: optional("GEMINI_API_KEY"),
    geminiModel: optional("GEMINI_MODEL", "gemini-2.5-flash"),
    geminiTemperature: Number(optional("GEMINI_TEMPERATURE", "0.2")),
    geminiUseGoogleSearch: booleanFlag(optional("GEMINI_USE_GOOGLE_SEARCH"), true),
    dailyBriefMaxPromptChars: Number(process.env.DAILY_BRIEF_MAX_PROMPT_CHARS || "45000"),
    dailyBriefMaxOutputTokens: Number(process.env.DAILY_BRIEF_MAX_OUTPUT_TOKENS || "4000"),
    dailyBriefRequireGrounding: booleanFlag(
      optional("DAILY_BRIEF_REQUIRE_GROUNDING"),
      true
    ),
    dailyBriefAllowAfterBudgetStop: booleanFlag(
      process.env.DAILY_BRIEF_ALLOW_AFTER_BUDGET_STOP,
      false
    ),
    gmailClientId: required("GMAIL_CLIENT_ID"),
    gmailClientSecret: required("GMAIL_CLIENT_SECRET"),
    gmailRefreshToken: required("GMAIL_REFRESH_TOKEN"),
    gmailSender: required("GMAIL_SENDER"),
    recipientEmail: recipientEmails[0],
    recipientEmails,
    pendingSyncToEmail: process.env.PENDING_SYNC_TO_EMAIL || recipientEmails[0]
  };
}
