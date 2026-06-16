import { getConfig } from "../config.js";
import { createAutomationStateStore } from "../services/automationStateStore.js";
import { createPendingSyncState } from "../services/pendingSyncState.js";
import { log } from "../lib/logger.js";

export async function recordNotionUpdate(args) {
  if (!args["page-id"] || !args["page-title"] || !args.summary) {
    throw new Error("Usage: record-notion-update --page-id <id> --page-title <title> --summary <summary>");
  }

  const config = getConfig();
  const stateStore = createAutomationStateStore(config);
  const pendingState = createPendingSyncState({ stateStore, config });

  const result = await pendingState.recordPending({
    pageId: args["page-id"],
    pageTitle: args["page-title"],
    summary: args.summary
  });

  log("Recorded pending Notion sync state.", {
    pageId: args["page-id"],
    pageTitle: args["page-title"],
    recordedAt: result.createdAt
  });
}
