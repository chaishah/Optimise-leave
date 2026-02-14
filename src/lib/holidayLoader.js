const parseCSV = (raw) => {
  const lines = raw.split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  const rows = []
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(',').map((p) => p.trim())
    if (parts.length === 1 && parts[0] === '') continue
    const row = {}
    headers.forEach((h, idx) => {
      row[h] = parts[idx] ?? ''
    })
    rows.push(row)
  }
  return rows
}

export const loadHolidays = async ({ country, year, subdivision }) => {
  if (!country || !year) return []
  const file = `/data/holidays-${country.toLowerCase()}-${year}.csv`
  const res = await fetch(file)
  if (!res.ok) return []
  const text = await res.text()
  const rows = parseCSV(text)

  return rows.filter((row) => {
    if (!row.date) return false
    if (row.country && row.country.toLowerCase() !== country.toLowerCase()) return false
    if (subdivision && row.subdivision && row.subdivision !== subdivision) return false
    return true
  })
}
