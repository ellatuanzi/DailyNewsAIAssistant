# Morning News Automation

This repository packages the daily Chinese morning brief as a deployable Render cron workflow.

## What runs online

- `daily-brief`: Generates and sends the daily email.
- `check-sync-prompts`: Looks for pending Notion research updates and asks whether to sync them into GitHub-backed research files.

## Current architecture

- Runtime: Node.js on Render Cron Jobs
- Delivery and state: Gmail API
- LLM generation: Gemini API with Google Search grounding required for the daily brief
- Research source of truth for production: local files in `research/`
- Notion usage: optional authoring workspace only, not a runtime dependency for the daily brief

## Render schedules

- `*/30 * * * *`: poll every 30 minutes, send the brief only after local `07:00 America/Los_Angeles`
- `*/30 * * * *`: poll every 30 minutes, send the sync confirmation only after local `09:00 America/Los_Angeles`

This avoids daylight-saving drift because Render cron schedules use UTC according to the official docs:
- [Render Cron Jobs](https://render.com/docs/cronjobs)
- [Render Blueprint Spec](https://render.com/docs/blueprint-spec)

## Required environment variables

### Gemini

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_TEMPERATURE`
- `GEMINI_USE_GOOGLE_SEARCH`

### Gmail

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_SENDER`
- `RECIPIENT_EMAIL`

### App config

- `TIMEZONE`
- `RESEARCH_DIR`
- `PENDING_SYNC_TO_EMAIL`
- `DAILY_BRIEF_MAX_PROMPT_CHARS`
- `DAILY_BRIEF_MAX_OUTPUT_TOKENS`
- `DAILY_BRIEF_REQUIRE_GROUNDING`
- `DAILY_BRIEF_ALLOW_AFTER_BUDGET_STOP`

## Repository layout

- `src/`: runtime code
- `research/`: local research source files exported from Notion and cleaned for production use
- `automation-2-*.md`: operating notes and requirements

## Research sync workflow

1. We update the working Notion pages during research.
2. A manual or scripted `record-notion-update` call records a pending sync reminder in Gmail state.
3. The next day, `check-sync-prompts` asks whether those Notion updates should also be synced into GitHub.
4. Only after confirmation do we update `research/` files and open a PR or commit the changes.

## Local development

Install dependencies:

```bash
npm install
```

Recommended guardrails:

- Keep `GEMINI_MODEL=gemini-2.5-flash` for lower cost than larger models.
- Keep `GEMINI_USE_GOOGLE_SEARCH=true` and `DAILY_BRIEF_REQUIRE_GROUNDING=true` so the job fails closed instead of inventing current news.
- Keep `DAILY_BRIEF_MAX_OUTPUT_TOKENS` capped so long outputs cannot silently expand spend.
- Keep `DAILY_BRIEF_MAX_PROMPT_CHARS` capped so research/context growth fails fast instead of billing unexpectedly.
- Keep `DAILY_BRIEF_ALLOW_AFTER_BUDGET_STOP=false` so quota/billing failures trip a persistent stop until we manually re-enable.
- Duplicate sends are prevented by checking Gmail for the day's final brief subject before generating.

Validate configuration:

```bash
npm run validate-config
```

Run the daily job locally:

```bash
npm run daily-brief
```

Force one manual run even if today's brief was already sent:

```bash
npm run daily-brief -- --force
```

Record a Notion update for next-day confirmation:

```bash
node src/cli.js record-notion-update --page-id stock-analysis --page-title "股票分析" --summary "更新了 AI 电力与数据中心主线"
```

## Notes

- The current repo includes the deployment skeleton and operational interfaces.
- The existing local macOS TTS script remains available at `render_tts_audio.sh`, but Render cannot run macOS `say`. Online audio generation needs a cloud TTS replacement in a later phase.
