import { todayInTimeZone } from "../lib/time.js";

function stateSubject(date) {
  return `[Automation State] Daily Brief LLM Attempt - ${date}`;
}

function budgetStopSubject() {
  return "[Automation State] Daily Brief Budget Stop";
}

export function createDailyBriefState({ gmail, config }) {
  return {
    async countTodayAttempts() {
      const date = todayInTimeZone(config.timezone);
      const query = `in:sent to:${config.gmailSender} subject:"${stateSubject(date)}"`;
      const messages = await gmail.search(query, 20);
      return messages.length;
    },

    async recordAttempt({ subject, promptLength }) {
      const date = todayInTimeZone(config.timezone);
      const body = [
        "This message is machine state for the Morning News automation.",
        `date: ${date}`,
        `provider: gemini`,
        `briefSubject: ${subject}`,
        `promptLength: ${promptLength}`,
        "status: started"
      ].join("\n");

      return gmail.sendMail({
        to: config.gmailSender,
        subject: stateSubject(date),
        body
      });
    },

    async hasBudgetStop() {
      const messages = await gmail.search(
        `in:sent to:${config.gmailSender} subject:"${budgetStopSubject()}"`,
        5
      );
      return messages.length > 0;
    },

    async recordBudgetStop({ errorMessage, status }) {
      const date = todayInTimeZone(config.timezone);
      const body = [
        "This message is machine state for the Morning News automation.",
        `date: ${date}`,
        "provider: gemini",
        "status: budget_stop",
        `httpStatus: ${status ?? "unknown"}`,
        `error: ${errorMessage}`
      ].join("\n");

      return gmail.sendMail({
        to: config.gmailSender,
        subject: budgetStopSubject(),
        body
      });
    }
  };
}
