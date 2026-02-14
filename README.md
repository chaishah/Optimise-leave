# Optimise Leave

A simple leave calculator that finds the longest continuous break by combining public holidays, weekends, and a fixed number of leave days. Built with React + Vite + Tailwind.

## Features
- Select country/state, year, and leave balance
- Provide a start date to consider leave from
- Computes the optimal continuous leave window
- Calendar view with weekends, holidays, and leave days highlighted

## Holiday data
Holiday files live in `public/data/` as CSVs (one per country/year). Add or edit rows to extend coverage.

## Local development
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Deploy (Vercel)
- Import the GitHub repo in Vercel
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

## Data format
CSV columns:
`date,country,subdivision,name,type`

Example:
`2026-01-26,au,NSW,Australia Day,public`
