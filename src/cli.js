import { runDailyBrief } from "./jobs/dailyBrief.js";
import { runSyncPromptCheck } from "./jobs/checkSyncPrompt.js";
import { recordNotionUpdate } from "./jobs/recordNotionUpdate.js";
import { validateConfig } from "./jobs/validateConfig.js";

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;

    const key = item.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : "true";
    args[key] = value;

    if (value !== "true") i += 1;
  }

  return args;
}

async function main() {
  const command = process.argv[2];
  const args = parseArgs(process.argv.slice(3));

  switch (command) {
    case "daily-brief":
      await runDailyBrief();
      return;
    case "check-sync-prompts":
      await runSyncPromptCheck();
      return;
    case "record-notion-update":
      await recordNotionUpdate(args);
      return;
    case "validate-config":
      await validateConfig();
      return;
    default:
      throw new Error(`Unknown command: ${command || "(missing)"}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
