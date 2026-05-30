import { getConfig } from "../config.js";
import { createGmailClient } from "../services/gmailClient.js";
import { loadResearchLibrary } from "../services/researchLibrary.js";
import { createGeminiClient } from "../services/geminiClient.js";
import { createDailyBriefState } from "../services/dailyBriefState.js";
import { buildDailyBriefPrompt } from "../prompts/dailyBriefPrompt.js";
import { log, warn } from "../lib/logger.js";
import { localTimeParts, todayInTimeZone } from "../lib/time.js";

export async function runDailyBrief(options = {}) {
  const force = options.force === true;
  const config = getConfig();
  const gmail = createGmailClient(config);
  const gemini = createGeminiClient(config);
  const briefState = createDailyBriefState({ gmail, config });
  const date = todayInTimeZone(config.timezone);
  const subject = `每日定制早报 - ${date}`;
  const { hour } = localTimeParts(config.timezone);

  if (!force && hour < 7) {
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

  if (!force && alreadySent.length > 0) {
    log("Daily brief already sent. Skipping.", { subject, recipient: config.recipientEmail });
    return;
  }

  if (force) {
    warn("Daily brief running in force mode.", {
      subject,
      bypassedChecks: [
        "local send window",
        "already sent check",
        "budget stop",
        "daily LLM attempt cap"
      ]
    });
  }

  if (!force && !config.dailyBriefAllowAfterBudgetStop) {
    const budgetStopped = await briefState.hasBudgetStop();

    if (budgetStopped) {
      warn("Daily brief budget stop is active. Skipping generation.", {
        subject
      });
      return;
    }
  }

  const researchContext = await loadResearchLibrary(config.researchDir);
  const prompt = buildDailyBriefPrompt({ date, researchContext });
  const promptLength = prompt.length;

  if (promptLength > config.dailyBriefMaxPromptChars) {
    throw new Error(
      `Daily brief prompt exceeded DAILY_BRIEF_MAX_PROMPT_CHARS (${promptLength} > ${config.dailyBriefMaxPromptChars}).`
    );
  }

  const attemptsToday = await briefState.countTodayAttempts();

  if (!force && attemptsToday >= config.dailyBriefMaxLlmAttemptsPerDay) {
    warn("Daily brief LLM attempt cap reached. Skipping generation.", {
      subject,
      attemptsToday,
      maxAttemptsPerDay: config.dailyBriefMaxLlmAttemptsPerDay
    });
    return;
  }

  await briefState.recordAttempt({ subject, promptLength });

  let body;
  try {
    body = await gemini.generateText(prompt);
  } catch (error) {
    if (error?.budgetStop) {
      await briefState.recordBudgetStop({
        errorMessage: error.message,
        status: error.status
      });
    }

    warn("Gemini generation failed.", {
      subject,
      status: error?.status,
      provider: error?.provider || "gemini",
      error: error?.message,
      budgetStop: Boolean(error?.budgetStop)
    });
    throw error;
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
