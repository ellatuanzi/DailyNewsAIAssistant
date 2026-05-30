# Render Variables Setup

Use [`render-env.template.txt`](/Users/qingcai/Documents/Morning%20News/render-env.template.txt) or [`.env.render.example`](/Users/qingcai/Documents/Morning%20News/.env.render.example) as the source-of-truth template when adding variables to Render.

## Recommended workflow

1. Copy [`.env.render.example`](/Users/qingcai/Documents/Morning%20News/.env.render.example) to a local gitignored file named `.env.render`
2. Fill in the real values locally
3. In Render, create an Environment Group named `morning-news-shared`
4. Use `Add from .env` to import `.env.render`
5. Link that env group to both cron services

## Recommended values

```text
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TEMPERATURE=0.2
TIMEZONE=America/Los_Angeles
RESEARCH_DIR=./research
APP_ENV=production
DAILY_BRIEF_MAX_PROMPT_CHARS=45000
DAILY_BRIEF_MAX_OUTPUT_TOKENS=4000
DAILY_BRIEF_MAX_LLM_ATTEMPTS_PER_DAY=1
DAILY_BRIEF_ALLOW_AFTER_BUDGET_STOP=false
```

## Add to both Render cron services

- `morning-news-daily-brief`
- `morning-news-sync-check`

The current [`render.yaml`](/Users/qingcai/Documents/Morning%20News/render.yaml) is already set up to reference the shared group:

```yaml
- fromGroup: morning-news-shared
```

## Variables to add

```text
GEMINI_API_KEY
GEMINI_MODEL
GEMINI_TEMPERATURE
GMAIL_CLIENT_ID
GMAIL_CLIENT_SECRET
GMAIL_REFRESH_TOKEN
GMAIL_SENDER
RECIPIENT_EMAIL
PENDING_SYNC_TO_EMAIL
TIMEZONE
RESEARCH_DIR
APP_ENV
DAILY_BRIEF_MAX_PROMPT_CHARS
DAILY_BRIEF_MAX_OUTPUT_TOKENS
DAILY_BRIEF_MAX_LLM_ATTEMPTS_PER_DAY
DAILY_BRIEF_ALLOW_AFTER_BUDGET_STOP
```

## Notes

- `GMAIL_SENDER`: the Gmail account that actually sends the email
- `RECIPIENT_EMAIL`: the morning brief recipient
- `PENDING_SYNC_TO_EMAIL`: who receives the next-day GitHub sync confirmation email
- `DAILY_BRIEF_MAX_LLM_ATTEMPTS_PER_DAY=1`: prevents repeated cron retries from making multiple paid model calls in one day
- `DAILY_BRIEF_ALLOW_AFTER_BUDGET_STOP=false`: if Gemini returns quota/billing exhaustion, the automation records a stop marker and future runs will not call the model again until you explicitly override
- `DAILY_BRIEF_MAX_PROMPT_CHARS`: hard-fails if prompt/context grows unexpectedly
- `DAILY_BRIEF_MAX_OUTPUT_TOKENS`: caps output size and therefore spend
- Do not commit real secret values into GitHub
- `.env.render` is gitignored and intended for local-only storage
