import { getConfig } from "../config.js";
import { createGmailClient } from "../services/gmailClient.js";
import { createPendingSyncState } from "../services/pendingSyncState.js";
import { log } from "../lib/logger.js";
import { localTimeParts, todayInTimeZone, yesterdayInTimeZone } from "../lib/time.js";

export async function runSyncPromptCheck() {
  const config = getConfig();
  const gmail = createGmailClient(config);
  const pendingState = createPendingSyncState({ gmail, config });
  const { hour } = localTimeParts(config.timezone);
  const promptDate = todayInTimeZone(config.timezone);

  if (hour < 9) {
    log("Sync prompt trigger fired before local send window. Skipping.", {
      timezone: config.timezone,
      localHour: hour
    });
    return;
  }

  const alreadySent = await gmail.search(
    `in:sent to:${config.pendingSyncToEmail} subject:"确认是否同步 GitHub 研究文件 - ${promptDate}"`,
    10
  );

  if (alreadySent.length > 0) {
    log("Sync confirmation already sent today. Skipping.", {
      date: promptDate
    });
    return;
  }

  const pending = await pendingState.findYesterdayPending();

  if (pending.length === 0) {
    log("No pending Notion sync reminders found for yesterday.", {
      date: yesterdayInTimeZone(config.timezone)
    });
    return;
  }

  const subject = `确认是否同步 GitHub 研究文件 - ${yesterdayInTimeZone(config.timezone)}`;
  const body = [
    "昨天我更新了相关 Notion 研究页面。",
    "",
    "如果你希望我把这些更新同步到 GitHub 仓库里的 research 文件，请直接回复确认。",
    "",
    `检测到的 pending 条目数：${pending.length}`,
    "",
    "这是一封确认邮件，不会自动改 GitHub 内容。"
  ].join("\n");

  const sent = await gmail.sendMail({
    to: config.pendingSyncToEmail,
    subject,
    body
  });

  log("Sent sync confirmation email.", {
    subject,
    recipient: config.pendingSyncToEmail,
    messageId: sent.id,
    pendingCount: pending.length
  });
}
