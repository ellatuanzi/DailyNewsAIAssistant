# Morning News Automation

This repository packages the daily Chinese morning brief as a deployable Render cron workflow.

## What runs online

- `daily-brief`: Generates and sends the daily email.
- `check-sync-prompts`: Looks for pending Notion research updates and asks whether to sync them into GitHub-backed research files.

## Current architecture

- Runtime: Node.js on Render Cron Jobs
- Delivery and state: Gmail API
- LLM generation: OpenAI API
- Research source of truth for production: local files in `research/`
- Notion usage: optional authoring workspace only, not a runtime dependency for the daily brief

## Render schedules

- `*/30 * * * *`: poll every 30 minutes, send the brief only after local `07:00 America/Los_Angeles`
- `*/30 * * * *`: poll every 30 minutes, send the sync confirmation only after local `09:00 America/Los_Angeles`

This avoids daylight-saving drift because Render cron schedules use UTC according to the official docs:
- [Render Cron Jobs](https://render.com/docs/cronjobs)
- [Render Blueprint Spec](https://render.com/docs/blueprint-spec)

## Required environment variables

### OpenAI

- `OPENAI_API_KEY`
- `OPENAI_MODEL`

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

Validate configuration:

```bash
npm run validate-config
```

Run the daily job locally:

```bash
npm run daily-brief
```

Record a Notion update for next-day confirmation:

```bash
node src/cli.js record-notion-update --page-id stock-analysis --page-title "股票分析" --summary "更新了 AI 电力与数据中心主线"
```

## Notes

- The current repo includes the deployment skeleton and operational interfaces.
- The existing local macOS TTS script remains available at [`/Users/qingcai/Documents/Morning News/render_tts_audio.sh`](/Users/qingcai/Documents/Morning%20News/render_tts_audio.sh), but Render cannot run macOS `say`. Online audio generation needs a cloud TTS replacement in a later phase.
