import { getYearDates, isWeekendUTC, toISODateUTC } from './dateUtils.js'

export const buildDayMap = (year, holidays, weekendDays) => {
  const holidayMap = new Map()
  holidays.forEach((h) => {
    if (h.date) {
      holidayMap.set(h.date, h)
    }
  })

  return getYearDates(year).map((date) => {
    const iso = toISODateUTC(date)
    const holiday = holidayMap.get(iso)
    const weekend = isWeekendUTC(date, weekendDays)
    return {
      date,
      iso,
      weekend,
      holiday,
      isOff: weekend || Boolean(holiday),
    }
  })
}

const buildResult = (days, start, end, leaveDays) => {
  const leaveDates = []
  for (let i = start; i <= end; i += 1) {
    if (!days[i].isOff && leaveDates.length < leaveDays) {
      leaveDates.push(days[i].iso)
    }
  }
  return {
    start,
    end,
    length: end >= start ? end - start + 1 : 0,
    leaveUsed: leaveDates.length,
    leaveDates,
    windowDates: days.slice(start, end + 1).map((d) => d.iso),
  }
}

export const findTopWindows = (days, leaveDays, includeIso, limit = 5) => {
  if (!days.length) {
    return []
  }
  const includeIndex = includeIso ? days.findIndex((d) => d.iso === includeIso) : -1
  if (includeIso && includeIndex === -1) return []
  if (includeIndex !== -1 && days[includeIndex].isBlocked) return []

  const candidates = []
  for (let start = 0; start < days.length; start += 1) {
    let leaveUsed = 0
    let end = start
    for (; end < days.length; end += 1) {
      if (days[end].isBlocked) break
      if (!days[end].isOff) leaveUsed += 1
      if (leaveUsed > leaveDays) break
    }
    const finalEnd = end - 1
    if (finalEnd < start) continue
    const includesRequired =
      includeIndex === -1 || (start <= includeIndex && finalEnd >= includeIndex)
    if (!includesRequired) continue
    candidates.push(buildResult(days, start, finalEnd, leaveDays))
  }

  candidates.sort((a, b) => b.length - a.length || a.start - b.start)
  const unique = []
  const seen = new Set()
  for (const item of candidates) {
    const key = `${item.start}-${item.end}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(item)
    if (unique.length >= limit) break
  }
  return unique
}

export const findOptimalWindow = (days, leaveDays, includeIso) => {
  const list = findTopWindows(days, leaveDays, includeIso, 1)
  return list[0] || {
    start: 0,
    end: -1,
    length: 0,
    leaveUsed: 0,
    leaveDates: [],
    windowDates: [],
  }
}
