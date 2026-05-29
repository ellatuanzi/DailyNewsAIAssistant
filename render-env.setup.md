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
OPENAI_MODEL=gpt-4.1
TIMEZONE=America/Los_Angeles
RESEARCH_DIR=./research
APP_ENV=production
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
OPENAI_API_KEY
OPENAI_MODEL
GMAIL_CLIENT_ID
GMAIL_CLIENT_SECRET
GMAIL_REFRESH_TOKEN
GMAIL_SENDER
RECIPIENT_EMAIL
PENDING_SYNC_TO_EMAIL
TIMEZONE
RESEARCH_DIR
APP_ENV
```

## Notes

- `GMAIL_SENDER`: the Gmail account that actually sends the email
- `RECIPIENT_EMAIL`: the morning brief recipient
- `PENDING_SYNC_TO_EMAIL`: who receives the next-day GitHub sync confirmation email
- Do not commit real secret values into GitHub
- `.env.render` is gitignored and intended for local-only storage
