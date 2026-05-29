import { getConfig } from "../config.js";
import { createGmailClient } from "../services/gmailClient.js";
import { loadResearchLibrary } from "../services/researchLibrary.js";
import { createOpenAiClient } from "../services/openaiClient.js";
import { buildDailyBriefPrompt } from "../prompts/dailyBriefPrompt.js";
import { log } from "../lib/logger.js";
import { localTimeParts, todayInTimeZone } from "../lib/time.js";

export async function runDailyBrief() {
  const config = getConfig();
  const gmail = createGmailClient(config);
  const openai = createOpenAiClient(config);
  const date = todayInTimeZone(config.timezone);
  const subject = `每日定制早报 - ${date}`;
  const { hour } = localTimeParts(config.timezone);

  if (hour < 7) {
    log("Daily brief trigger fired before local send window. Skipping.", {
      timezone: config.timezone,
      localHour: hour
    });
    return;
  }

  const alreadySent = await gmail.search(
    `in:sent to:${config.recipientEmail} subject:"${subject}"`,
    10
  );

  if (alreadySent.length > 0) {
    log("Daily brief already sent. Skipping.", { subject, recipient: config.recipientEmail });
    return;
  }

  const researchContext = await loadResearchLibrary(config.researchDir);
  const prompt = buildDailyBriefPrompt({ date, researchContext });

  const response = await openai.responses.create({
    model: config.openAiModel,
    input: prompt
  });

  const body = response.output_text?.trim();

  if (!body) {
    throw new Error("OpenAI returned an empty daily brief body.");
  }

  const sent = await gmail.sendMail({
    to: config.recipientEmail,
    subject,
    body
  });

  log("Daily brief sent.", {
    subject,
    recipient: config.recipientEmail,
    messageId: sent.id
  });
}
