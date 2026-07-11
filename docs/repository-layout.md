# Repository Layout Rules

This repository has a clear split between runtime code, versioned source data, and local-only working artifacts. New files should follow these placement rules so the project root stays stable and readable.

## Where To Look First

- Start with this file when deciding where a new file belongs.
- Use `README.md` for the product overview and setup flow.
- Use `ARCHITECTURE.md` for runtime boundaries and major code areas.
- Use `CLAUDE.md` for agent-facing working conventions.
- Use `docs/archive/` for internal reports, handoffs, and non-runtime deliverables that should not be published.
- Use `design_handoff_pitchsignal/` for the canonical design handoff package and UI audit material.

## Root Contract

Only keep these categories at the repository root:

- runtime entrypoints and build config: `server.js`, `package.json`, `Dockerfile`, `railway.toml`, `render.yaml`
- top-level product docs that explain the app as a whole: `README.md`, `ARCHITECTURE.md`, `ENVIRONMENT.md`, `CHANGELOG.md`, `CLAUDE.md`
- primary source directories: `lib/`, `middleware/`, `services/`, `static/`, `templates/`, `scripts/`, `data/`, `docs/`, `outputs/`, `resources/`

Do not add one-off reports, preview HTML, local logs, or ad hoc exports at the root.

## Directory Rules

- `lib/`, `middleware/`, `services/`: runtime application code only
- `static/`, `templates/`: browser assets and HTML actually served by the app
- `scripts/`: reusable automation, build helpers, and committed test runners
- `scratch/`: temporary experiments and throwaway diagnostics
- `scratch/previews/`: standalone local preview HTML or render experiments
- `data/`: runtime JSON, SQLite files, and app-readable source inputs
- `data/sources/world-cup-history/`: local historical CSV inputs used to build H2H context
- `docs/`: versioned project documentation that should remain shareable
- `docs/archive/`: local reports, handoff copies, marketing drafts, and other non-runtime artifacts
- `outputs/`: generated research outputs, backtest predictions, and calibration artifacts
- `resources/`: seed JSON datasets, ID mapping bridges, and static reference tables
- `design_handoff_pitchsignal/`: canonical design handoff package and UI audit material
- `logs/`: local runtime logs only

## Placement Rules

- If the server reads it at runtime, it belongs under `data/`, `static/`, `templates/`, `lib/`, `middleware/`, or `services/`.
- If a script is reusable across sessions, put it in `scripts/`; if it is exploratory or one-off, put it in `scratch/`.
- If a document is a durable project reference, keep it in `docs/`; if it is a local deliverable or archival artifact, put it in `docs/archive/`.
- Keep only one canonical copy of design handoff material in `design_handoff_pitchsignal/`.
- Keep generated databases, WAL files, logs, and previews out of version control.

## Naming Rules

- Prefer kebab-case directory names without spaces.
- Avoid duplicate copies of the same document in multiple top-level locations.
- Use path names that reveal lifecycle: `sources`, `archive`, `previews`, `logs`.

## Change Discipline

- Before moving any file that code may read, search references first with `rg`.
- When a path change affects runtime data, update the code and verify with tests or a health check.
- If a file is local-only, make sure `.gitignore` and `.dockerignore` reflect its final home.
