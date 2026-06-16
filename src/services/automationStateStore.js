import { createHash } from "node:crypto";
import { mkdir, readFile, appendFile } from "node:fs/promises";
import path from "node:path";

function hashPart(value) {
  return createHash("sha1").update(String(value)).digest("hex");
}

function eventsFilePath(stateDir) {
  return path.join(stateDir, "automation-events.jsonl");
}

async function readEvents(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function createFileStateStore(config) {
  const filePath = eventsFilePath(config.stateDir);

  async function appendEvent(type, payload) {
    await mkdir(config.stateDir, { recursive: true });
    const event = {
      type,
      createdAt: new Date().toISOString(),
      ...payload
    };
    await appendFile(filePath, `${JSON.stringify(event)}\n`, "utf8");
    return event;
  }

  return {
    async hasDailyBriefBeenSent({ subject, recipient, date }) {
      const events = await readEvents(filePath);
      return events.some(
        (event) =>
          event.type === "daily_brief_sent" &&
          event.subject === subject &&
          event.recipient === recipient &&
          event.date === date
      );
    },

    recordDailyBriefSent({ date, subject, recipient, messageId, provider }) {
      return appendEvent("daily_brief_sent", {
        date,
        subject,
        recipient,
        messageId,
        provider
      });
    },

    async hasBudgetStop() {
      const events = await readEvents(filePath);
      return events.some((event) => event.type === "daily_brief_budget_stop");
    },

    recordBudgetStop({ date, errorMessage, status }) {
      return appendEvent("daily_brief_budget_stop", {
        date,
        provider: "gemini",
        status: "budget_stop",
        httpStatus: status ?? "unknown",
        error: errorMessage
      });
    },

    recordPendingSync({ date, pageId, pageTitle, summary }) {
      return appendEvent("notion_sync_pending", {
        date,
        pageId,
        pageTitle,
        summary,
        status: "pending"
      });
    },

    async findPendingSyncByDate(date) {
      const events = await readEvents(filePath);
      return events.filter(
        (event) => event.type === "notion_sync_pending" && event.date === date
      );
    },

    async hasSyncPromptBeenSent({ subject, recipient, date }) {
      const events = await readEvents(filePath);
      return events.some(
        (event) =>
          event.type === "sync_prompt_sent" &&
          event.subject === subject &&
          event.recipient === recipient &&
          event.date === date
      );
    },

    recordSyncPromptSent({ date, subject, recipient, messageId, provider, pendingCount }) {
      return appendEvent("sync_prompt_sent", {
        date,
        subject,
        recipient,
        messageId,
        provider,
        pendingCount
      });
    }
  };
}

function createUpstashRedisClient(config) {
  async function command(...args) {
    const response = await fetch(`${config.upstashRedisRestUrl}/${args.map(encodeURIComponent).join("/")}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.upstashRedisRestToken}`
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.error) {
      const message =
        data?.error || `Upstash Redis request failed with status ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.provider = "upstash-redis";
      error.details = data;
      throw error;
    }

    return data.result;
  }

  return {
    get: (key) => command("get", key),
    set: (key, value) => command("set", key, JSON.stringify(value)),
    keys: (pattern) => command("keys", pattern).then((result) => result || []),
    mget: (...keys) => command("mget", ...keys).then((result) => result || [])
  };
}

function createRedisStateStore(config) {
  const redis = createUpstashRedisClient(config);
  const prefix = "morning-news";

  function key(...parts) {
    return [prefix, ...parts].join(":");
  }

  async function getJson(keyName) {
    const raw = await redis.get(keyName);
    if (!raw) return null;
    return JSON.parse(raw);
  }

  async function setJson(keyName, value) {
    const payload = {
      createdAt: new Date().toISOString(),
      ...value
    };
    await redis.set(keyName, payload);
    return payload;
  }

  function sentKey(type, date, recipient, subject) {
    return key(type, date, hashPart(recipient), hashPart(subject));
  }

  return {
    async hasDailyBriefBeenSent({ subject, recipient, date }) {
      const record = await getJson(sentKey("daily_brief_sent", date, recipient, subject));
      return Boolean(record);
    },

    recordDailyBriefSent({ date, subject, recipient, messageId, provider }) {
      return setJson(sentKey("daily_brief_sent", date, recipient, subject), {
        type: "daily_brief_sent",
        date,
        subject,
        recipient,
        messageId,
        provider
      });
    },

    async hasBudgetStop() {
      const record = await getJson(key("daily_brief_budget_stop"));
      return Boolean(record);
    },

    recordBudgetStop({ date, errorMessage, status }) {
      return setJson(key("daily_brief_budget_stop"), {
        type: "daily_brief_budget_stop",
        date,
        provider: "gemini",
        status: "budget_stop",
        httpStatus: status ?? "unknown",
        error: errorMessage
      });
    },

    recordPendingSync({ date, pageId, pageTitle, summary }) {
      return setJson(key("notion_sync_pending", date, pageId), {
        type: "notion_sync_pending",
        date,
        pageId,
        pageTitle,
        summary,
        status: "pending"
      });
    },

    async findPendingSyncByDate(date) {
      const keys = await redis.keys(key("notion_sync_pending", date, "*"));

      if (keys.length === 0) {
        return [];
      }

      const values = await redis.mget(...keys);
      return values.filter(Boolean).map((value) => JSON.parse(value));
    },

    async hasSyncPromptBeenSent({ subject, recipient, date }) {
      const record = await getJson(sentKey("sync_prompt_sent", date, recipient, subject));
      return Boolean(record);
    },

    recordSyncPromptSent({ date, subject, recipient, messageId, provider, pendingCount }) {
      return setJson(sentKey("sync_prompt_sent", date, recipient, subject), {
        type: "sync_prompt_sent",
        date,
        subject,
        recipient,
        messageId,
        provider,
        pendingCount
      });
    }
  };
}

export function createAutomationStateStore(config) {
  if (config.stateProvider === "upstash-redis") {
    return createRedisStateStore(config);
  }

  if (config.stateProvider === "file") {
    return createFileStateStore(config);
  }

  throw new Error(
    `Unsupported STATE_PROVIDER: ${config.stateProvider}. Expected "file" or "upstash-redis".`
  );
}
