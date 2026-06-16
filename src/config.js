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

function normalizeStateProvider(value) {
  return (value || "file").trim().toLowerCase();
}

export function getConfig() {
  const recipientEmails = parseEmailList(
    optional("RECIPIENT_EMAILS", process.env.RECIPIENT_EMAIL || "")
  );

  if (recipientEmails.length === 0) {
    throw new Error("Missing required environment variable: RECIPIENT_EMAILS or RECIPIENT_EMAIL");
  }

  const emailProvider = optional("EMAIL_PROVIDER", "gmail");
  const emailSender = optional("EMAIL_SENDER", process.env.GMAIL_SENDER);
  const stateProvider = normalizeStateProvider(optional("STATE_PROVIDER", "file"));

  if (!emailSender) {
    throw new Error("Missing required environment variable: EMAIL_SENDER");
  }

  const config = {
    appEnv: process.env.APP_ENV || "development",
    timezone: process.env.TIMEZONE || "America/Los_Angeles",
    researchDir: process.env.RESEARCH_DIR || path.resolve(process.cwd(), "research"),
    stateDir: process.env.STATE_DIR || path.resolve(process.cwd(), ".state"),
    stateProvider,
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
    emailProvider,
    emailSender,
    recipientEmail: recipientEmails[0],
    recipientEmails,
    pendingSyncToEmail: process.env.PENDING_SYNC_TO_EMAIL || recipientEmails[0]
  };

  if (emailProvider === "resend") {
    const resendConfig = {
      ...config,
      resendApiKey: required("RESEND_API_KEY")
    };

    if (stateProvider === "upstash-redis") {
      return {
        ...resendConfig,
        upstashRedisRestUrl: required("UPSTASH_REDIS_REST_URL"),
        upstashRedisRestToken: required("UPSTASH_REDIS_REST_TOKEN")
      };
    }

    if (stateProvider === "file") {
      return resendConfig;
    }

    throw new Error(
      `Unsupported STATE_PROVIDER: ${stateProvider}. Expected "file" or "upstash-redis".`
    );
  }

  if (emailProvider === "gmail") {
    if (stateProvider === "upstash-redis") {
      return {
        ...config,
        gmailClientId: required("GMAIL_CLIENT_ID"),
        gmailClientSecret: required("GMAIL_CLIENT_SECRET"),
        gmailRefreshToken: required("GMAIL_REFRESH_TOKEN"),
        upstashRedisRestUrl: required("UPSTASH_REDIS_REST_URL"),
        upstashRedisRestToken: required("UPSTASH_REDIS_REST_TOKEN")
      };
    }

    if (stateProvider === "file") {
      return {
        ...config,
        gmailClientId: required("GMAIL_CLIENT_ID"),
        gmailClientSecret: required("GMAIL_CLIENT_SECRET"),
        gmailRefreshToken: required("GMAIL_REFRESH_TOKEN")
      };
    }

    throw new Error(
      `Unsupported STATE_PROVIDER: ${stateProvider}. Expected "file" or "upstash-redis".`
    );
  }

  throw new Error(
    `Unsupported EMAIL_PROVIDER: ${emailProvider}. Expected "gmail" or "resend".`
  );
}
