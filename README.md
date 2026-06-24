# Morning News Automation

This repository packages a two-edition Chinese email brief as a deployable Render cron workflow.

## What runs online

- `daily-brief`: Generates and sends the morning tech/markets edition by default.
- `daily-brief:midday`: Generates and sends the midday culture/topic edition.
- `check-sync-prompts`: Looks for pending Notion research updates and asks whether to sync them into GitHub-backed research files.

## Current architecture

- Runtime: Node.js on Render Cron Jobs
- Delivery: Gmail API or Resend API
- State and dedupe: `Upstash Redis` via REST for production, local JSONL event store in `.state/` for fallback
- LLM generation: Gemini API with Google Search grounding required for the daily brief
- Research source of truth for production: local files in `research/`
- Notion usage: optional authoring workspace only, not a runtime dependency for the daily brief

## Render schedules

- `*/30 * * * *`: poll every 30 minutes, send the morning edition only after local `07:00 America/Los_Angeles`
- `*/30 * * * *`: poll every 30 minutes, send the midday edition only after local `12:00 America/Los_Angeles`
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

### Delivery

- `EMAIL_PROVIDER`: `gmail` or `resend`
- `EMAIL_SENDER`
- `RECIPIENT_EMAILS` or `RECIPIENT_EMAIL`

### Resend

- `RESEND_API_KEY`

### Gmail fallback

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`

### App config

- `TIMEZONE`
- `BRIEF_EDITION`
- `BRIEF_SUBJECT_PREFIX`
- `BRIEF_SEND_HOUR`
- `RESEARCH_DIR`
- `STATE_PROVIDER`
- `STATE_DIR`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `PENDING_SYNC_TO_EMAIL`
- `DAILY_BRIEF_MAX_PROMPT_CHARS`
- `DAILY_BRIEF_MAX_OUTPUT_TOKENS`
- `DAILY_BRIEF_MIN_SOURCE_LINES`
- `DAILY_BRIEF_REQUIRE_GROUNDING`
- `DAILY_BRIEF_ALLOW_AFTER_BUDGET_STOP`

## Repository layout

- `src/`: runtime code for both morning and midday editions
- `research/`: local research source files exported from Notion and cleaned for production use
- `automation-2-*.md`: operating notes and requirements

## Research sync workflow

1. We update the working Notion pages during research.
2. A manual or scripted `record-notion-update` call records a pending sync reminder in local automation state.
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
- On Render, use `STATE_PROVIDER=upstash-redis` so dedupe and reminders survive between cron runs.
- Keep `.state/` only for local development or as a fallback when `STATE_PROVIDER=file`.

Validate configuration:

```bash
npm run validate-config
```

Run the morning job locally:

```bash
npm run daily-brief
```

Run the midday job locally:

```bash
npm run daily-brief:midday
```

Force one manual run even if today's edition was already sent:

```bash
npm run daily-brief -- --force
```

Force one midday run:

```bash
npm run daily-brief -- --edition midday --force
```

Record a Notion update for next-day confirmation:

```bash
node src/cli.js record-notion-update --page-id stock-analysis --page-title "股票分析" --summary "更新了 AI 电力与数据中心主线"
```

## Notes

- The current repo includes the deployment skeleton and operational interfaces.
- Morning edition stays focused on tech, finance, stocks, and time-sensitive sports/news.
- Midday edition is intentionally broader: it can be a topic, a book, a film, an exhibition, or a Bay Area activity, not necessarily a news roundup.
- The existing local macOS TTS script remains available at `render_tts_audio.sh`, but Render cannot run macOS `say`. Online audio generation needs a cloud TTS replacement in a later phase.
