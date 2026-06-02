import { getConfig } from "../config.js";
import { createGmailClient } from "../services/gmailClient.js";
import { loadResearchLibrary } from "../services/researchLibrary.js";
import { createGeminiClient } from "../services/geminiClient.js";
import { createDailyBriefState } from "../services/dailyBriefState.js";
import { fetchDailyWeather } from "../services/weatherClient.js";
import {
  buildDailyBriefPrompt,
  buildGroundingRetryPrompt
} from "../prompts/dailyBriefPrompt.js";
import { log, warn } from "../lib/logger.js";
import { localTimeParts, todayInTimeZone } from "../lib/time.js";

function countSourceLines(body) {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^来源[:：]/u.test(line)).length;
}

function validateDailyBriefBody(body) {
  const sourceLineCount = countSourceLines(body);

  if (sourceLineCount < 6) {
    throw new Error(
      `Daily brief body has too few source lines (${sourceLineCount}); refusing to send potentially unverified news.`
    );
  }
}

async function generateDailyBrief({ gemini, config, subject, prompts }) {
  let lastError;

  for (let attempt = 0; attempt < prompts.length; attempt += 1) {
    const prompt = prompts[attempt];

    try {
      const generation = await gemini.generateText(prompt.body, {
        grounded: config.geminiUseGoogleSearch,
        requireGrounding: config.dailyBriefRequireGrounding
      });

      return {
        ...generation,
        attemptLabel: prompt.label,
        attemptNumber: attempt + 1
      };
    } catch (error) {
      lastError = error;

      warn("Gemini generation attempt failed.", {
        subject,
        attempt: attempt + 1,
        attemptLabel: prompt.label,
        status: error?.status,
        provider: error?.provider || "gemini",
        error: error?.message,
        errorCode: error?.code,
        budgetStop: Boolean(error?.budgetStop),
        groundingQueries: error?.details?.grounding?.queries || [],
        groundingSourceCount: error?.details?.grounding?.chunks?.length || 0
      });

      const canRetryForGrounding =
        error?.code === "missing_grounding" && attempt < prompts.length - 1;

      if (canRetryForGrounding) {
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

export async function runDailyBrief(options = {}) {
  const force = options.force === true;
  const config = getConfig();

  if (!config.geminiApiKey) {
    throw new Error("Missing required environment variable for daily brief: GEMINI_API_KEY");
  }

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
        "budget stop"
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
  let weatherContext;
  try {
    weatherContext = await fetchDailyWeather();
  } catch (error) {
    warn("Weather fetch failed.", {
      subject,
      error: error?.message
    });
    weatherContext = {
      unavailable: true,
      note: "天气数据暂缺，需补抓取"
    };
  }

  const primaryPrompt = buildDailyBriefPrompt({ date, researchContext, weatherContext });
  const retryPrompt = buildGroundingRetryPrompt({ date, researchContext, weatherContext });
  const prompts = [
    { label: "full", body: primaryPrompt },
    { label: "compact-grounding-retry", body: retryPrompt }
  ];
  const promptLength = primaryPrompt.length;

  if (promptLength > config.dailyBriefMaxPromptChars) {
    throw new Error(
      `Daily brief prompt exceeded DAILY_BRIEF_MAX_PROMPT_CHARS (${promptLength} > ${config.dailyBriefMaxPromptChars}).`
    );
  }

  let generation;
  try {
    generation = await generateDailyBrief({
      gemini,
      config,
      subject,
      prompts
    });
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
      errorCode: error?.code,
      budgetStop: Boolean(error?.budgetStop),
      groundingQueries: error?.details?.grounding?.queries || [],
      groundingSourceCount: error?.details?.grounding?.chunks?.length || 0
    });
    throw error;
  }

  const body = generation.text;
  validateDailyBriefBody(body);

  const sent = await gmail.sendMail({
    to: config.recipientEmail,
    subject,
    body
  });

  log("Daily brief sent.", {
    subject,
    recipient: config.recipientEmail,
    messageId: sent.id,
    generationAttemptLabel: generation.attemptLabel,
    generationAttemptNumber: generation.attemptNumber,
    groundingQueries: generation.grounding?.queries || [],
    groundingSourceCount: generation.grounding?.chunks?.length || 0
  });
}
