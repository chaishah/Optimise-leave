const pad2 = (n) => String(n).padStart(2, '0')

export const toISODateUTC = (date) => {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
}

export const fromISODateUTC = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export const getYearDates = (year) => {
  const dates = []
  const start = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year + 1, 0, 1))

  for (let d = start; d < end; d = new Date(d.getTime() + 86400000)) {
    dates.push(new Date(d))
  }

  return dates
}

export const isWeekendUTC = (date) => {
  const day = date.getUTCDay()
  return day === 0 || day === 6
}

export const monthLabel = (year, monthIndex) => {
  const date = new Date(Date.UTC(year, monthIndex, 1))
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export const dayLabel = (date) => {
  return date.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' })
}

export const getMonthMatrix = (year, monthIndex) => {
  const first = new Date(Date.UTC(year, monthIndex, 1))
  const last = new Date(Date.UTC(year, monthIndex + 1, 0))
  const startOffset = (first.getUTCDay() + 6) % 7
  const totalDays = last.getUTCDate()

  const cells = []
  for (let i = 0; i < startOffset; i += 1) {
    cells.push(null)
  }
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(new Date(Date.UTC(year, monthIndex, day)))
  }
  while (cells.length % 7 !== 0) {
    cells.push(null)
  }
  return cells
}
