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

const fetchCSVRows = async (file) => {
  const res = await fetch(file)
  if (!res.ok) return []
  const text = await res.text()
  return parseCSV(text)
}

const matchesRegion = (row, country, subdivision) => {
  if (!row.date && !row.start) return false
  if (row.country && row.country.toLowerCase() !== country.toLowerCase()) return false
  if (subdivision && row.subdivision && row.subdivision !== subdivision) return false
  return true
}

const addDaysUTC = (iso, days) => {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const expandDateRangeRows = (rows, year) => {
  const startOfYear = `${year}-01-01`
  const endOfYear = `${year}-12-31`
  const expanded = []

  rows.forEach((row) => {
    const start = row.start || row.date
    const end = row.end || row.date || row.start
    if (!start || !end) return

    let date = start < startOfYear ? startOfYear : start
    const last = end > endOfYear ? endOfYear : end
    while (date <= last) {
      expanded.push({ ...row, date })
      date = addDaysUTC(date, 1)
    }
  })

  return expanded
}

export const loadHolidays = async ({ country, year, subdivision }) => {
  if (!country || !year) return []
  const file = `/data/holidays-${country.toLowerCase()}-${year}.csv`
  const rows = await fetchCSVRows(file)
  return rows.filter((row) => {
    return matchesRegion(row, country, subdivision)
  })
}

export const loadSchoolHolidays = async ({ country, year, subdivision }) => {
  if (country !== 'au' || !year) return []
  const file = `/data/school-holidays-${country.toLowerCase()}-${year}.csv`
  const rows = await fetchCSVRows(file)
  return expandDateRangeRows(
    rows.filter((row) => matchesRegion(row, country, subdivision)),
    year
  )
}
