import path from "node:path";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getConfig() {
  return {
    appEnv: process.env.APP_ENV || "development",
    timezone: process.env.TIMEZONE || "America/Los_Angeles",
    researchDir: process.env.RESEARCH_DIR || path.resolve(process.cwd(), "research"),
    openAiApiKey: required("OPENAI_API_KEY"),
    openAiModel: process.env.OPENAI_MODEL || "gpt-4.1",
    gmailClientId: required("GMAIL_CLIENT_ID"),
    gmailClientSecret: required("GMAIL_CLIENT_SECRET"),
    gmailRefreshToken: required("GMAIL_REFRESH_TOKEN"),
    gmailSender: required("GMAIL_SENDER"),
    recipientEmail: required("RECIPIENT_EMAIL"),
    pendingSyncToEmail: process.env.PENDING_SYNC_TO_EMAIL || required("RECIPIENT_EMAIL")
  };
}
