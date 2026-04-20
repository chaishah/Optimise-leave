# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
```

No test or lint scripts are configured.

## Architecture

**Optimise Leave** is a single-page React app that finds the longest continuous break by combining public holidays, weekends, and personal leave days. State is managed entirely in React hooks inside `App.jsx` and serialized to the URL on every change (shareable/bookmarkable links via `window.history.replaceState`).

### Data flow

1. User selects country, year, and leave budget
2. `holidayLoader.js` fetches a CSV from `public/data/holidays-{country}-{year}.csv`
3. `optimizer.js → buildDayMap()` produces a date-keyed map of day metadata (weekend, holiday, blackout, etc.)
4. `optimizer.js → findTopWindows()` runs a greedy sliding-window algorithm to find the top N non-overlapping leave windows within the budget, respecting blackout dates and must-include constraints
5. `getCurveSuggestions()` (in App.jsx) sweeps the budget from 0 to max to build a tradeoff curve (days off vs leave spent)
6. `Calendar.jsx` renders month grids from the `dayMeta` map; it is a pure display component

### Key files

| File | Role |
|------|------|
| `src/App.jsx` | All state, computation orchestration, URL sync, rendering (~1 200 lines) |
| `src/lib/optimizer.js` | `buildDayMap()`, `findTopWindows()`, `findOptimalWindow()` |
| `src/lib/dateUtils.js` | UTC-safe date helpers used everywhere — do not bypass these |
| `src/lib/holidayLoader.js` | Fetches and parses holiday CSVs |
| `src/components/Calendar.jsx` | Month-grid UI; reads `dayMeta` prop |
| `public/data/*.csv` | Holiday source data; columns: `date,country,subdivision,name,type` |

### Date handling

All dates are handled in UTC throughout (`dateUtils.js`) to avoid DST inconsistencies. Always use the provided helpers (`toISODateUTC`, `isWeekendUTC`, etc.) rather than `new Date()` with local timezone methods.

### Adding a new country/year

Drop a CSV at `public/data/holidays-{cc}-{yyyy}.csv` matching the existing column format and register the country code in the country list inside `App.jsx`.

## Development conventions (from AGENTS.md)

- Keep edits small and incremental; avoid large refactors
- Add comments only for non-obvious logic (not for what the code does)
- No new dependencies unless they remove more complexity than they add
- Mobile-first, responsive design using the custom Tailwind theme (colors: ink, sand, acid, blood, sky, moss)
- Avoid hard-coded current date/time in any logic (use params/inputs for testability)
