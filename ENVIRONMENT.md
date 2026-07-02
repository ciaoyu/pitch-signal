# Environment and Key Hygiene

This project uses a project-local `.env` file. Do not use one lifetime/global `.env` for every project.

## Files

- `.env`: real local secrets for this project only. Never commit it.
- `.env.example`: committed template with empty values and provider examples.
- `secrets/`: ignored. Use only for temporary local experiments, not for source control.

## Audit Status

- `.env` is ignored by `.gitignore` and has never been committed to this repository's history — verified with `git log --all --full-history -- .env` (no results) and a full-history scan for common API key formats (`sk-`, `sk-ant-`, `AIza`, `ghp_`, Slack tokens — no matches).
- `.env.example` is the only tracked env file, and every value in it is empty.

## Recommended Variables

```bash
BALLDONTLIE_API_KEY=
ODDS_API_KEY=
OWM_API_KEY=
TAVILY_API_KEY=
TRANSLATE_API_URL=
TRANSLATE_API_KEY=
TRANSLATE_MODEL=
CORS_ORIGINS=http://localhost:5099,http://127.0.0.1:5099
```

## Operating Rules

- Do not paste real API keys into chat, docs, issues, or reports.
- If a key is ever committed, synced somewhere unexpected, or otherwise exposed, rotate it immediately.
- Add new required variables to `.env.example` with empty values.

## Checks

Run this before starting or deploying the dashboard:

```bash
npm run check:env
```

The check only prints whether variables are present or missing. It never prints secret values.
