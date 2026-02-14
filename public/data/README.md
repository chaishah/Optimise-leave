# Holiday CSV format

One CSV per country/year in this folder. File name pattern:

- holidays-au-2026.csv
- holidays-in-2027.csv

Columns (comma-separated):

- date: YYYY-MM-DD (local calendar date)
- country: ISO-like short code (au, in)
- subdivision: state/region code (e.g., NSW, VIC). Leave blank for national holidays.
- name: holiday name
- type: optional tag (public, observance, etc.)

Example row:
2026-01-26,au,NSW,Australia Day,public

Notes:
- Use uppercase state codes for Australia.
- UK subdivisions: EAW (England & Wales), SCT (Scotland), NIR (Northern Ireland).
- For India, leave subdivision blank for national holidays or use a state code you define.
- Add only official public holidays you want the planner to treat as days off.
