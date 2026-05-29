# Render Variables Setup

Use [`render-env.template.txt`](/Users/qingcai/Documents/Morning%20News/render-env.template.txt) as the source-of-truth template when adding variables to Render.

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
