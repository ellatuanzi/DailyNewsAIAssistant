import { getConfig } from "../config.js";
import { createEmailClient } from "../services/emailClient.js";
import { loadResearchLibrary } from "../services/researchLibrary.js";
import { createGeminiClient } from "../services/geminiClient.js";
import { createDailyBriefState } from "../services/dailyBriefState.js";
import { createAutomationStateStore } from "../services/automationStateStore.js";
import { fetchDailyWeather } from "../services/weatherClient.js";
import { fetchPodcastUpdates } from "../services/podcastClient.js";
import { fetchEtfQuotes } from "../services/financeClient.js";
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

function validateDailyBriefBody(body, minimumSources = 6) {
  const sourceLineCount = countSourceLines(body);

  if (sourceLineCount < minimumSources) {
    throw new Error(
      `Daily brief body has too few source lines (${sourceLineCount} < ${minimumSources}); refusing to send potentially unverified content.`
    );
  }
}

function getSourceLineCount(body) {
  return countSourceLines(body);
}

async function filterRecipientsWithVerifiedSentMail({ email, subject, recipients }) {
  if (typeof email.hasSentMessage !== "function") {
    return recipients;
  }

  const checks = await Promise.all(
    recipients.map(async (recipient) => ({
      recipient,
      verified: await email.hasSentMessage({ to: recipient, subject })
    }))
  );

  return checks.filter(({ verified }) => verified).map(({ recipient }) => recipient);
}

function appendGroundingSources(body, grounding, minimumSources = 6) {
  const currentCount = getSourceLineCount(body);

  if (currentCount >= minimumSources) {
    return {
      body,
      sourceLineCount: currentCount
    };
  }

  const chunks = grounding?.chunks || [];
  const seenUris = new Set();
  const sourceLines = [];

  for (const chunk of chunks) {
    if (!chunk?.uri || seenUris.has(chunk.uri)) continue;
    seenUris.add(chunk.uri);
    sourceLines.push(`来源：${chunk.title || "Source"} ${chunk.uri}`);
  }

  if (sourceLines.length === 0) {
    return {
      body,
      sourceLineCount: currentCount
    };
  }

  const mergedBody = `${body.trim()}\n\n补充来源：\n${sourceLines.join("\n")}`;

  return {
    body: mergedBody,
    sourceLineCount: getSourceLineCount(mergedBody)
  };
}

async function generateDailyBrief({ gemini, config, subject, prompts }) {
  let lastError;

  for (let attempt = 0; attempt < prompts.length; attempt += 1) {
    const prompt = prompts[attempt];

    try {
      const generation = await gemini.generateText(prompt.body, {
        grounded: config.geminiUseGoogleSearch,
        requireGrounding: prompt.requireGrounding ?? config.dailyBriefRequireGrounding
      });

      const normalized = appendGroundingSources(
        generation.text,
        generation.grounding,
        config.dailyBriefMinSourceLines
      );
      const sourceLineCount = normalized.sourceLineCount;
      const needsSourceFormatRetry =
        prompt.retryOnTooFewSourceLines === true &&
        sourceLineCount < config.dailyBriefMinSourceLines &&
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
        text: normalized.body,
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
  const config = getConfig({ edition: options.edition });

  if (!config.geminiApiKey) {
    throw new Error("Missing required environment variable for daily brief: GEMINI_API_KEY");
  }

  const email = createEmailClient(config);
  const gemini = createGeminiClient(config);
  const stateStore = createAutomationStateStore(config);
  const briefState = createDailyBriefState({ stateStore, config });
  const date = todayInTimeZone(config.timezone);
  const subject = `${config.briefSubjectPrefix} - ${date}`;
  const { hour } = localTimeParts(config.timezone);
  const recipients = config.recipientEmails;

  if (!force && hour < config.briefSendHour) {
    log("Daily brief trigger fired before local send window. Skipping.", {
      timezone: config.timezone,
      localHour: hour,
      sendHour: config.briefSendHour,
      edition: config.briefEdition
    });
    return;
  }

  const sentChecks = await Promise.all(
    recipients.map(async (recipient) => ({
      recipient,
      alreadySent: await stateStore.hasDailyBriefBeenSent({
        date,
        subject,
        recipient
      })
    }))
  );
  const alreadySentRecipients = sentChecks
    .filter(({ alreadySent }) => alreadySent)
    .map(({ recipient }) => recipient);

  const verifiedSentRecipients = await filterRecipientsWithVerifiedSentMail({
    email,
    subject,
    recipients: alreadySentRecipients
  });

  const recipientsToSend = force
    ? recipients
    : recipients.filter((recipient) => !verifiedSentRecipients.includes(recipient));

  if (!force && verifiedSentRecipients.length > 0) {
    const unverifiedRecipients = alreadySentRecipients.filter(
      (recipient) => !verifiedSentRecipients.includes(recipient)
    );

    if (unverifiedRecipients.length > 0) {
      warn("Daily brief state indicated sent, but mailbox verification failed for some recipients.", {
        subject,
        unverifiedRecipients
      });
    }

    if (recipientsToSend.length === 0) {
      log("Daily brief already sent. Skipping.", {
        subject,
        recipients,
        alreadySentRecipients: verifiedSentRecipients
      });
      return;
    }

    warn("Daily brief will resend only to recipients missing verified sent mail.", {
      subject,
      alreadySentRecipients: verifiedSentRecipients,
      recipientsToSend
    });
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
  let quoteContext;
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

  try {
    quoteContext = await fetchEtfQuotes();
    if (quoteContext.partial) {
      warn("ETF quote fetch partially failed.", {
        subject,
        missingSymbols: quoteContext.missingSymbols
      });
    }
  } catch (error) {
    warn("ETF quote fetch failed.", {
      subject,
      error: error?.message
    });
    quoteContext = {
      unavailable: true,
      note: "ETF 行情数据暂缺，需补抓取",
      quotes: [],
      missingSymbols: []
    };
  }

  const primaryPrompt = buildDailyBriefPrompt({
    date,
    edition: config.briefEdition,
    researchContext,
    weatherContext,
    podcastContext,
    quoteContext
  });
  const retryPrompt = buildGroundingRetryPrompt({
    date,
    edition: config.briefEdition,
    researchContext,
    weatherContext,
    podcastContext,
    quoteContext
  });
  const sourceFormatRetryPrompt = buildSourceFormatRetryPrompt({
    date,
    edition: config.briefEdition,
    researchContext,
    weatherContext,
    podcastContext,
    quoteContext
  });
  const prompts = [
    {
      label: "full",
      body: primaryPrompt,
      retryOnTooFewSourceLines: true,
      requireGrounding: config.dailyBriefRequireGrounding
    },
    {
      label: "compact-grounding-retry",
      body: retryPrompt,
      retryOnTooFewSourceLines: true,
      requireGrounding: config.dailyBriefRequireGrounding
    },
    {
      label: "source-format-retry",
      body: sourceFormatRetryPrompt,
      retryOnTooFewSourceLines: false,
      requireGrounding: false
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
  validateDailyBriefBody(body, config.dailyBriefMinSourceLines);

  const recipientHeader = recipientsToSend.join(", ");
  const sent = await email.sendMail({
    to: recipientHeader,
    subject,
    body
  });

  await Promise.all(
    recipientsToSend.map((recipient) =>
      stateStore.recordDailyBriefSent({
        date,
        subject,
        recipient,
        messageId: sent.id,
        provider: config.emailProvider
      })
    )
  );

  log("Daily brief sent.", {
    edition: config.briefEdition,
    subject,
    recipients: recipientsToSend,
    messageId: sent.id,
    generationAttemptLabel: generation.attemptLabel,
    generationAttemptNumber: generation.attemptNumber,
    sourceLineCount: generation.sourceLineCount,
    groundingQueries: generation.grounding?.queries || [],
    groundingSourceCount: generation.grounding?.chunks?.length || 0
  });
}
