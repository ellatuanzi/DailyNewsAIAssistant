import { todayInTimeZone, yesterdayInTimeZone } from "../lib/time.js";

function stateSubject(date, pageId) {
  return `[Automation State] Notion Sync Pending - ${date} - ${pageId}`;
}

export function createPendingSyncState({ stateStore, config }) {
  return {
    async recordPending({ pageId, pageTitle, summary }) {
      const date = todayInTimeZone(config.timezone);
      return stateStore.recordPendingSync({
        date,
        subject: stateSubject(date, pageId),
        pageId,
        pageTitle,
        summary
      });
    },

    async findYesterdayPending() {
      const date = yesterdayInTimeZone(config.timezone);
      return stateStore.findPendingSyncByDate(date);
    }
  };
}
