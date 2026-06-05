import { getConfig } from "../config.js";
import { createGmailClient } from "../services/gmailClient.js";
import { loadResearchLibrary } from "../services/researchLibrary.js";
import { createGeminiClient } from "../services/geminiClient.js";
import { createDailyBriefState } from "../services/dailyBriefState.js";
import { fetchDailyWeather } from "../services/weatherClient.js";
import { fetchPodcastUpdates } from "../services/podcastClient.js";
import {
  buildDailyBriefPrompt,
  buildGroundingRetryPrompt,
  buildSourceFormatRetryPrompt
} from "../prompts/dailyBriefPrompt.js";
import { log, warn } from "../lib/logger.js";
import { localTimeParts, todayInTimeZone } from "../lib/time.js";

function isSourceEvidenceLine(line) {
  const trimmed = line.trim();

  if (!trimmed) return false;

  const hasUrl = /https?:\/\/\S+/i.test(trimmed);
  const startsWithSourceLabel =
    /^[\-*•]?\s*(来源|来源链接|链接|source|link)\s*[:：-]/iu.test(trimmed);
  const isStandaloneUrl = /^https?:\/\/\S+$/i.test(trimmed);

  return startsWithSourceLabel || isStandaloneUrl || (hasUrl && startsWithSourceLabel);
}

function countSourceLines(body) {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(isSourceEvidenceLine).length;
}

function validateDailyBriefBody(body) {
  const sourceLineCount = countSourceLines(body);

  if (sourceLineCount < 6) {
    throw new Error(
      `Daily brief body has too few source lines (${sourceLineCount}); refusing to send potentially unverified news.`
    );
  }
}

function getSourceLineCount(body) {
  return countSourceLines(body);
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

      const sourceLineCount = getSourceLineCount(generation.text);
      const needsSourceFormatRetry =
        prompt.retryOnTooFewSourceLines === true &&
        sourceLineCount < 6 &&
        attempt < prompts.length - 1;

      if (needsSourceFormatRetry) {
        warn("Gemini generation produced too few source lines; retrying with stricter format prompt.", {
          subject,
          attempt: attempt + 1,
          attemptLabel: prompt.label,
          sourceLineCount
        });
        continue;
      }

      return {
        ...generation,
        attemptLabel: prompt.label,
        attemptNumber: attempt + 1,
        sourceLineCount
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
  const recipients = config.recipientEmails;
  const recipientHeader = recipients.join(", ");

  if (!force && hour < 7) {
    log("Daily brief trigger fired before local send window. Skipping.", {
      timezone: config.timezone,
      localHour: hour
    });
    return;
  }

  const sentChecks = await Promise.all(
    recipients.map(async (recipient) => ({
      recipient,
      messages: await gmail.search(`in:sent to:${recipient} subject:"${subject}"`, 10)
    }))
  );
  const alreadySentRecipients = sentChecks
    .filter(({ messages }) => messages.length > 0)
    .map(({ recipient }) => recipient);

  if (!force && alreadySentRecipients.length > 0) {
    log("Daily brief already sent. Skipping.", {
      subject,
      recipients,
      alreadySentRecipients
    });
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
  let podcastContext;
  try {
    weatherContext = await fetchDailyWeather();
    if (weatherContext.partial) {
      warn("Weather fetch partially failed.", {
        subject,
        failures: weatherContext.failures
      });
    }
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

  try {
    podcastContext = await fetchPodcastUpdates();
    if (podcastContext.partial) {
      warn("Podcast fetch partially failed.", {
        subject,
        failures: podcastContext.failures
      });
    }
  } catch (error) {
    warn("Podcast fetch failed.", {
      subject,
      error: error?.message
    });
    podcastContext = {
      unavailable: true,
      note: "Podcast 数据暂缺，需补抓取",
      podcasts: [],
      failures: []
    };
  }

  const primaryPrompt = buildDailyBriefPrompt({
    date,
    researchContext,
    weatherContext,
    podcastContext
  });
  const retryPrompt = buildGroundingRetryPrompt({
    date,
    researchContext,
    weatherContext,
    podcastContext
  });
  const sourceFormatRetryPrompt = buildSourceFormatRetryPrompt({
    date,
    researchContext,
    weatherContext,
    podcastContext
  });
  const prompts = [
    { label: "full", body: primaryPrompt, retryOnTooFewSourceLines: true },
    {
      label: "compact-grounding-retry",
      body: retryPrompt,
      retryOnTooFewSourceLines: true
    },
    {
      label: "source-format-retry",
      body: sourceFormatRetryPrompt,
      retryOnTooFewSourceLines: false
    }
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
    to: recipientHeader,
    subject,
    body
  });

  log("Daily brief sent.", {
    subject,
    recipients,
    messageId: sent.id,
    generationAttemptLabel: generation.attemptLabel,
    generationAttemptNumber: generation.attemptNumber,
    sourceLineCount: generation.sourceLineCount,
    groundingQueries: generation.grounding?.queries || [],
    groundingSourceCount: generation.grounding?.chunks?.length || 0
  });
}
