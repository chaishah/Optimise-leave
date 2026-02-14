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

export const findOptimalWindow = (days, leaveDays, includeIso) => {
  if (!days.length) {
    return {
      start: 0,
      end: -1,
      length: 0,
      leaveUsed: 0,
      leaveDates: [],
      windowDates: [],
    }
  }
  const includeIndex = includeIso ? days.findIndex((d) => d.iso === includeIso) : -1
  let best = { start: 0, end: 0, length: 0, leaveUsed: 0 }
  let start = 0
  let workingInWindow = 0

  for (let end = 0; end < days.length; end += 1) {
    if (!days[end].isOff) workingInWindow += 1

    while (workingInWindow > leaveDays && start <= end) {
      if (!days[start].isOff) workingInWindow -= 1
      start += 1
    }

    const length = end - start + 1
    const includesRequired = includeIndex === -1 || (start <= includeIndex && end >= includeIndex)
    if (includesRequired && length > best.length) {
      best = { start, end, length, leaveUsed: workingInWindow }
    }
  }

  const leaveDates = []
  for (let i = best.start; i <= best.end; i += 1) {
    if (!days[i].isOff && leaveDates.length < leaveDays) {
      leaveDates.push(days[i].iso)
    }
  }

  return {
    ...best,
    leaveDates,
    windowDates: days.slice(best.start, best.end + 1).map((d) => d.iso),
  }
}
