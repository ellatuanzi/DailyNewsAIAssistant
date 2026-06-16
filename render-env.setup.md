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
EMAIL_PROVIDER
EMAIL_SENDER
RESEND_API_KEY
STATE_PROVIDER
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
GMAIL_CLIENT_ID
GMAIL_CLIENT_SECRET
GMAIL_REFRESH_TOKEN
GMAIL_SENDER
RECIPIENT_EMAILS
PENDING_SYNC_TO_EMAIL
TIMEZONE
RESEARCH_DIR
STATE_DIR
APP_ENV
DAILY_BRIEF_MAX_PROMPT_CHARS
DAILY_BRIEF_MAX_OUTPUT_TOKENS
DAILY_BRIEF_ALLOW_AFTER_BUDGET_STOP
```

## Notes

- `EMAIL_PROVIDER`: set to `resend` for the recommended long-term setup; keep `gmail` only as fallback
- `EMAIL_SENDER`: the verified sender identity, for example `Morning News <brief@yourdomain.com>`
- `RESEND_API_KEY`: required when `EMAIL_PROVIDER=resend`
- `STATE_PROVIDER`: use `upstash-redis` on Render for durable dedupe and reminders; keep `file` only for local development
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: required when `STATE_PROVIDER=upstash-redis`
- `GMAIL_SENDER`: legacy Gmail sender field; only needed when `EMAIL_PROVIDER=gmail`
- `RECIPIENT_EMAILS`: comma-separated morning brief recipients
- `PENDING_SYNC_TO_EMAIL`: who receives the next-day GitHub sync confirmation email
- `STATE_DIR`: local fallback path when `STATE_PROVIDER=file`
- `DAILY_BRIEF_ALLOW_AFTER_BUDGET_STOP=false`: if Gemini returns quota/billing exhaustion, the automation records a stop marker and future runs will not call the model again until you explicitly override
- `DAILY_BRIEF_MAX_PROMPT_CHARS`: hard-fails if prompt/context grows unexpectedly
- `DAILY_BRIEF_MAX_OUTPUT_TOKENS`: caps output size and therefore spend
- Duplicate sends are prevented by the configured state store, not by querying a mailbox
- Do not commit real secret values into GitHub
- `.env.render` is gitignored and intended for local-only storage
