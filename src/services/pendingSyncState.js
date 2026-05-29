import { todayInTimeZone, yesterdayInTimeZone } from "../lib/time.js";

function stateSubject(date, pageId) {
  return `[Automation State] Notion Sync Pending - ${date} - ${pageId}`;
}

export function createPendingSyncState({ gmail, config }) {
  return {
    async recordPending({ pageId, pageTitle, summary }) {
      const date = todayInTimeZone(config.timezone);
      const subject = stateSubject(date, pageId);
      const body = [
        "This message is machine state for the Morning News automation.",
        `date: ${date}`,
        `pageId: ${pageId}`,
        `pageTitle: ${pageTitle}`,
        `summary: ${summary}`,
        "status: pending"
      ].join("\n");

      return gmail.sendMail({
        to: config.gmailSender,
        subject,
        body
      });
    },

    async findYesterdayPending() {
      const date = yesterdayInTimeZone(config.timezone);
      const query = `in:sent to:${config.gmailSender} subject:"[Automation State] Notion Sync Pending - ${date}"`;
      return gmail.search(query, 20);
    }
  };
}
