import { todayInTimeZone } from "../lib/time.js";

function budgetStopSubject() {
  return "[Automation State] Daily Brief Budget Stop";
}

export function createDailyBriefState({ stateStore, config }) {
  return {
    async hasBudgetStop() {
      return stateStore.hasBudgetStop();
    },

    async recordBudgetStop({ errorMessage, status }) {
      const date = todayInTimeZone(config.timezone);
      return stateStore.recordBudgetStop({
        date,
        subject: budgetStopSubject(),
        errorMessage,
        status
      });
    }
  };
}
