# Environment and Key Hygiene

This project uses a project-local `.env` file. Do not use one lifetime/global `.env` for every project.

## Files

- `.env`: real local secrets for this project only. Never commit it.
- `.env.example`: committed template with empty values and provider examples.
- `secrets/`: ignored. Use only for temporary local experiments, not for source control.

## Current Audit Notes

- `.env` is ignored by `.gitignore`.
- `.env.example` is the only tracked env file.
- Git history shows `.env` was added in commit `d40fd68` and deleted in commit `60a9418`.
- `reports/architecture-review-20260616.md` previously included a literal `BALLDONTLIE_API_KEY`; it has been redacted in the working tree.
- Treat any key that may have been in that historical `.env` as exposed and rotate it.

## Recommended Variables

```bash
BALLDONTLIE_API_KEY=
ODDS_API_KEY=
OWM_API_KEY=
TAVILY_API_KEY=
TRANSLATE_API_URL=
TRANSLATE_API_KEY=
TRANSLATE_MODEL=
CORS_ORIGINS=http://localhost:5099,http://127.0.0.1:5099,http://192.168.2.231:5099
```

## Operating Rules

- Use separate provider keys for Mac and NAS when possible.
- Keep the variable names the same on each machine; only the values differ.
- Do not paste real API keys into chat, docs, issues, or reports.
- If a key was synced to another machine or committed, rotate it.
- Add new required variables to `.env.example` with empty values.

## Checks

Run this before starting or deploying the dashboard:

```bash
npm run check:env
```

The check only prints whether variables are present or missing. It never prints secret values.

Syncthing ignore rules are generated from the workspace-level `SYNC_MANIFEST.yaml`. The manifest excludes `.env`, `.env.*`, `*.env`, `.envrc`, `secrets/`, `*.key`, `*.pem`, and dashboard database files such as `data/*.db-*`.
