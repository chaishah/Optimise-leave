# AGENTS.md — Leave Calculator Web App

These instructions apply to all agents working in this repository.

## Project goals
- Build a simple, reliable leave calculator web app.
- Prioritize correctness, clarity, and fast load time.
- Keep scope minimal: calculate leave balances, accruals, and usage with clear inputs/outputs.

## Working agreements
- Keep edits small and incremental; avoid large refactors unless requested.
- Prefer plain, readable code over clever abstractions.
- Add succinct comments only when logic is non-obvious.
- Do not introduce dependencies unless they remove more complexity than they add.

## Repo conventions
- Use ASCII-only in new files unless the file already uses Unicode.
- Place app code under `app/` and shared utilities under `src/`.
- Keep configuration in project root.

## Frontend expectations
- Mobile-first, responsive layout.
- Clear form inputs with validation and helpful error messages.
- Accessible labels, focus states, and keyboard navigation.
- Keep styling cohesive (define CSS variables; avoid default system fonts).

## Data and logic
- Treat dates carefully; all calculations must be timezone-safe.
- When relevant, use explicit dates (YYYY-MM-DD) in UI and tests.
- Validate inputs (e.g., start date before end date; non-negative balances).

## Testing
- Add/extend tests for calculation logic when implementing features.
- Prefer deterministic tests; avoid relying on current date/time without a fixed reference.

## Tooling
- Prefer `rg` for search.
- Use `apply_patch` for single-file edits when practical.

## Communication
- Summarize changes concisely.
- Ask clarifying questions if requirements are ambiguous or missing.
