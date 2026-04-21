import { useEffect, useMemo, useState } from 'react'
import Calendar from './components/Calendar.jsx'
import { loadHolidays, loadSchoolHolidays } from './lib/holidayLoader.js'
import { buildDayMap, findOptimalWindow, findTopWindows } from './lib/optimizer.js'

const COUNTRIES = [
  {
    code: 'au',
    name: 'Australia',
    subdivisions: [
      { code: 'ACT', name: 'ACT' },
      { code: 'NSW', name: 'NSW' },
      { code: 'NT', name: 'NT' },
      { code: 'QLD', name: 'QLD' },
      { code: 'SA', name: 'SA' },
      { code: 'TAS', name: 'TAS' },
      { code: 'VIC', name: 'VIC' },
      { code: 'WA', name: 'WA' },
    ],
  },
  {
    code: 'uk',
    name: 'United Kingdom',
    subdivisions: [
      { code: 'EAW', name: 'England & Wales' },
      { code: 'SCT', name: 'Scotland' },
      { code: 'NIR', name: 'Northern Ireland' },
    ],
  },
  {
    code: 'in',
    name: 'India',
    subdivisions: [],
  },
]

const YEARS = [2026, 2027]
const WEEKDAYS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
]

const DEFAULT_MEMBERS = [{ id: 1, name: 'You', leaveDays: 12 }]

const getYearStartDate = (year) => `${year}-01-01`

const getDefaultStartDate = (year) => {
  const today = new Date()
  if (today.getFullYear() !== year) return getYearStartDate(year)

  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const toNonNegativeNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback
}

/* ─── shared class fragments ─── */
const CARD = 'rounded-2xl border border-l3 bg-l1 shadow-elevated'
const PANEL = 'rounded-xl border border-l3 bg-l2 p-5'
const INPUT_CLS =
  'w-full rounded-xl border border-l3 bg-l1 px-4 py-3 text-sm text-sand placeholder:text-sand/30 focus:outline-none focus:ring-2 focus:ring-primary/40'
const LABEL_CLS = 'text-[10px] font-medium uppercase tracking-[0.28em] text-sand/40'
const PILL_ACTIVE = 'border-primary/50 bg-primary/10 text-sand'
const PILL_IDLE = 'border-l3 bg-l2 text-sand/50 hover:text-sand/80'

const App = () => {
  const [country, setCountry] = useState('au')
  const [subdivision, setSubdivision] = useState('NSW')
  const [year, setYear] = useState(2026)
  const [holidays, setHolidays] = useState([])
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState('Ready when you are.')
  const [startDate, setStartDate] = useState(() => getDefaultStartDate(2026))
  const [mustInclude, setMustInclude] = useState('')
  const [weekendDays, setWeekendDays] = useState([6, 0])
  const [copied, setCopied] = useState(false)
  const [blackoutDates, setBlackoutDates] = useState([])
  const [blackoutInput, setBlackoutInput] = useState('')
  const [members, setMembers] = useState(DEFAULT_MEMBERS)
  const [topWindows, setTopWindows] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [calendarFilter, setCalendarFilter] = useState('all')
  const [curvePoints, setCurvePoints] = useState([])
  const [curveSuggestions, setCurveSuggestions] = useState([])
  const [suggestionWindows, setSuggestionWindows] = useState({})
  const [plannedLeaveSpend, setPlannedLeaveSpend] = useState(null)
  const [useUnpaidLeave, setUseUnpaidLeave] = useState(false)
  const [unpaidLeaveDays, setUnpaidLeaveDays] = useState(0)
  const [useBudgetSafePaidLeave, setUseBudgetSafePaidLeave] = useState(false)
  const [showSchoolHolidays, setShowSchoolHolidays] = useState(false)
  const [preferSchoolHolidays, setPreferSchoolHolidays] = useState(false)
  const [schoolHolidays, setSchoolHolidays] = useState([])
  const [view, setView] = useState('planner')
  const [calendarViewMode, setCalendarViewMode] = useState('combined')

  const countryInfo = COUNTRIES.find((c) => c.code === country)

  const familyLeaveBudget = useMemo(() => {
    if (!members.length) return 0
    return Math.min(...members.map((m) => toNonNegativeNumber(m.leaveDays)))
  }, [members])

  const paidLeaveBudget = useMemo(() => {
    if (plannedLeaveSpend === null || plannedLeaveSpend === '') return familyLeaveBudget
    return toNonNegativeNumber(plannedLeaveSpend)
  }, [familyLeaveBudget, plannedLeaveSpend])

  const unpaidLeaveBudget = useMemo(() => {
    return useUnpaidLeave ? toNonNegativeNumber(unpaidLeaveDays) : 0
  }, [unpaidLeaveDays, useUnpaidLeave])

  const paidLeaveOverBudget = Math.max(0, paidLeaveBudget - familyLeaveBudget)
  const effectivePaidLeaveBudget = useBudgetSafePaidLeave
    ? Math.min(paidLeaveBudget, familyLeaveBudget)
    : paidLeaveBudget
  const reallocatedUnpaidBudget = useBudgetSafePaidLeave && useUnpaidLeave
    ? paidLeaveOverBudget
    : 0
  const effectiveUnpaidLeaveBudget = unpaidLeaveBudget + reallocatedUnpaidBudget
  const totalLeaveBudget = effectivePaidLeaveBudget + effectiveUnpaidLeaveBudget
  const plannerYears = useMemo(() => [year, year + 1], [year])
  const schoolOverlayEnabled = country === 'au' && (showSchoolHolidays || preferSchoolHolidays)

  const leaveBreakdown = useMemo(() => {
    const leaveDates = result?.leaveDates || []
    const paidCount = Math.min(leaveDates.length, effectivePaidLeaveBudget)
    return {
      paidDates: leaveDates.slice(0, paidCount),
      unpaidDates: leaveDates.slice(paidCount),
      paidUsed: paidCount,
      unpaidUsed: Math.max(0, leaveDates.length - paidCount),
    }
  }, [effectivePaidLeaveBudget, result])

  useEffect(() => {
    if (!countryInfo) return
    const codes = countryInfo.subdivisions.map((s) => s.code)
    if (!codes.length) {
      setSubdivision('')
      return
    }
    if (!codes.includes(subdivision)) {
      setSubdivision(codes[0])
    }
  }, [country, countryInfo, subdivision])

  const dayMeta = useMemo(() => {
    const days = buildDayMap(plannerYears, holidays, weekendDays)
    const blackoutSet = new Set(blackoutDates)
    const leaveSet = new Set(result?.leaveDates || [])
    const unpaidLeaveSet = new Set(leaveBreakdown.unpaidDates)
    const windowSet = new Set(result?.windowDates || [])
    const schoolHolidayMap = new Map()
    if (schoolOverlayEnabled) {
      schoolHolidays.forEach((holiday) => {
        schoolHolidayMap.set(holiday.date, holiday)
      })
    }
    const meta = {}
    days.forEach((day) => {
      const schoolHoliday = schoolHolidayMap.get(day.iso)
      meta[day.iso] = {
        isWeekend: day.weekend,
        isHoliday: Boolean(day.holiday),
        isSchoolHoliday: Boolean(schoolHoliday),
        isLeave: leaveSet.has(day.iso),
        isUnpaidLeave: unpaidLeaveSet.has(day.iso),
        isWindow: windowSet.has(day.iso),
        isBlocked: blackoutSet.has(day.iso),
        label: day.holiday?.name || '',
        schoolLabel: schoolHoliday?.name || '',
      }
    })
    return meta
  }, [
    plannerYears,
    holidays,
    result,
    weekendDays,
    blackoutDates,
    leaveBreakdown,
    schoolHolidays,
    schoolOverlayEnabled,
  ])

  const handleCompute = async (preferredIndex = 0, spendOverride) => {
    setIsLoading(true)
    setStatus('Loading holidays…')
    const [list, schoolList] = await Promise.all([
      Promise.all(
        plannerYears.map((plannerYear) =>
          loadHolidays({ country, year: plannerYear, subdivision })
        )
      ).then((rows) => rows.flat()),
      schoolOverlayEnabled
        ? Promise.all(
            plannerYears.map((plannerYear) =>
              loadSchoolHolidays({ country, year: plannerYear, subdivision })
            )
          ).then((rows) => rows.flat())
        : Promise.resolve([]),
    ])
    setHolidays(list)
    setSchoolHolidays(schoolList)

    if (list.length === 0) {
      setStatus('No holidays loaded. Populate the CSV to unlock accurate results.')
    } else {
      setStatus(`Loaded ${list.length} holidays. Optimizing…`)
    }

    const days = buildDayMap(plannerYears, list, weekendDays)
    const blackoutSet = new Set(blackoutDates)
    const daysWithBlocks = days.map((d) => ({ ...d, isBlocked: blackoutSet.has(d.iso) }))
    const filteredWithBlocks = daysWithBlocks.filter((d) => d.iso >= startDate)
    const includeDate = mustInclude && mustInclude >= startDate ? mustInclude : ''
    const maxBudget = familyLeaveBudget
    const leaveBudget =
      typeof spendOverride === 'number' ? toNonNegativeNumber(spendOverride) : totalLeaveBudget
    const schoolHolidaySet = new Set(schoolList.map((holiday) => holiday.date))
    const getWindows = (leaveDays, limit = 5) => {
      const candidateLimit = preferSchoolHolidays && schoolHolidaySet.size ? 200 : limit
      const candidates = findTopWindows(
        filteredWithBlocks,
        Number(leaveDays),
        includeDate,
        candidateLimit
      )
      if (!preferSchoolHolidays || !schoolHolidaySet.size) return candidates.slice(0, limit)
      return candidates
        .filter((win) => win.windowDates.some((date) => schoolHolidaySet.has(date)))
        .slice(0, limit)
    }
    const windows = getWindows(leaveBudget, 5)
    setTopWindows(windows)
    const nextIndex = windows[preferredIndex] ? preferredIndex : 0
    const selected = windows[nextIndex] || windows[0] || null
    setSelectedIndex(nextIndex)
    setResult(
      selected ||
        (preferSchoolHolidays && schoolHolidaySet.size
          ? null
          : findOptimalWindow(filteredWithBlocks, Number(leaveBudget), includeDate))
    )
    const curve = []
    const maxCurve = Math.max(maxBudget, leaveBudget, 1)
    for (let i = 0; i <= maxCurve; i += 1) {
      const best = getWindows(i, 1)[0]
      curve.push({ leave: i, daysOff: best ? best.length : 0 })
    }
    setCurvePoints(curve)
    const suggestions = getCurveSuggestions(curve)
    setCurveSuggestions(suggestions)
    const suggestionMap = {}
    suggestions.forEach((s) => {
      suggestionMap[s.leave] = getWindows(s.leave, 3)
    })
    setSuggestionWindows(suggestionMap)
    if (preferSchoolHolidays && schoolHolidaySet.size && !windows.length) {
      setStatus('No school-holiday-aligned window found with these settings.')
    } else {
      const schoolNote = schoolOverlayEnabled ? ` School rows: ${schoolList.length}.` : ''
      setStatus(`Done - ${windows[0]?.length ?? 0} days off found.${schoolNote}`)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    setPlannedLeaveSpend((prev) => {
      if (prev === null) return familyLeaveBudget
      return prev
    })
  }, [familyLeaveBudget])

  const canProceed = totalLeaveBudget > 0 && startDate

  const counts = useMemo(() => {
    if (!result || result.length === 0) {
      return { weekends: 0, holidays: 0, school: 0, leave: 0, unpaid: 0 }
    }
    const windowSet = new Set(result.windowDates)
    let weekends = 0
    let holidaysCount = 0
    let school = 0
    let leave = 0
    let unpaid = 0
    Object.entries(dayMeta).forEach(([iso, meta]) => {
      if (!windowSet.has(iso)) return
      if (meta.isWeekend) weekends += 1
      if (meta.isHoliday) holidaysCount += 1
      if (meta.isSchoolHoliday) school += 1
      if (meta.isLeave) leave += 1
      if (meta.isUnpaidLeave) unpaid += 1
    })
    return { weekends, holidays: holidaysCount, school, leave, unpaid }
  }, [dayMeta, result])

  const canExport = Boolean(result && result.length > 0)

  const perMemberPlan = useMemo(() => {
    return members.map((m) => {
      const balance = toNonNegativeNumber(m.leaveDays)
      return {
        id: m.id,
        name: m.name,
        balance,
        used: leaveBreakdown.paidUsed,
        unpaid: leaveBreakdown.unpaidUsed,
        remaining: balance - leaveBreakdown.paidUsed,
      }
    })
  }, [leaveBreakdown, members])

  const curveSummary = useMemo(() => {
    if (!curvePoints.length) return { maxLeave: 0, maxDays: 0 }
    const last = curvePoints[curvePoints.length - 1]
    return { maxLeave: last.leave, maxDays: last.daysOff }
  }, [curvePoints])

  const visibleCalendarMonths = useMemo(() => {
    if (!result?.windowDates?.length) return null
    return [
      ...new Set(
        result.windowDates.map((iso) => {
          const [windowYear, month] = iso.split('-')
          return `${windowYear}-${month}`
        })
      ),
    ]
      .map((key) => {
        const [windowYear, month] = key.split('-').map(Number)
        return { year: windowYear, month: month - 1 }
      })
      .filter(({ year: windowYear, month }) => windowYear && month >= 0 && month < 12)
  }, [result])

  const tradeoffInsights = useMemo(() => {
    if (curvePoints.length < 2) return { bestJumps: [], diminishing: null }
    const jumps = []
    for (let i = 1; i < curvePoints.length; i += 1) {
      const prev = curvePoints[i - 1]
      const curr = curvePoints[i]
      jumps.push({
        from: prev.leave,
        to: curr.leave,
        gain: curr.daysOff - prev.daysOff,
      })
    }
    const bestJumps = [...jumps].sort((a, b) => b.gain - a.gain).slice(0, 3)
    const diminishing =
      jumps.find((j) => j.gain < 2) || jumps[jumps.length - 1] || null
    return { bestJumps, diminishing }
  }, [curvePoints])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const parsedLeave = Number(params.get('leave'))
    const parsedYear = Number(params.get('year'))
    const parsedWeekend = params.get('weekend')
    const parsedStart = params.get('start')
    const parsedInclude = params.get('include')

    const parsedOption = Number(params.get('option'))
    const parsedSpend = Number(params.get('spend'))
    const parsedUnpaid = params.get('unpaid')
    const parsedUnpaidDays = Number(params.get('unpaidDays'))
    if (!Number.isNaN(parsedYear) && YEARS.includes(parsedYear)) setYear(parsedYear)
    if (parsedStart) setStartDate(parsedStart)
    if (parsedInclude) setMustInclude(parsedInclude)
    const parsedBlackout = params.get('blackout')
    if (parsedBlackout) {
      setBlackoutDates(
        parsedBlackout
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean)
      )
    }
    const countryParam = params.get('country')
    const subdivisionParam = params.get('subdivision')
    if (countryParam && COUNTRIES.some((c) => c.code === countryParam)) setCountry(countryParam)
    if (subdivisionParam) setSubdivision(subdivisionParam)
    if (parsedWeekend) {
      const parsed = parsedWeekend
        .split(',')
        .map((v) => Number(v))
        .filter((v) => !Number.isNaN(v))
      if (parsed.length) setWeekendDays(parsed)
    }
    const parsedMembers = params.get('members')
    if (parsedMembers) {
      const list = parsedMembers.split('|').map((entry, idx) => {
        const [name, days] = entry.split(':')
        return {
          id: idx + 1,
          name: name ? decodeURIComponent(name) : `Member ${idx + 1}`,
          leaveDays: Number(days) || 0,
        }
      })
      if (list.length) setMembers(list)
    }
    if (!parsedMembers && !Number.isNaN(parsedLeave) && parsedLeave > 0) {
      setMembers([{ id: 1, name: 'You', leaveDays: parsedLeave }])
    }
    const parsedFilter = params.get('filter')
    if (parsedFilter) setCalendarFilter(parsedFilter)
    if (!Number.isNaN(parsedOption) && parsedOption >= 0) setSelectedIndex(parsedOption)
    if (!Number.isNaN(parsedSpend) && parsedSpend >= 0) setPlannedLeaveSpend(parsedSpend)
    if (parsedUnpaid === '1') setUseUnpaidLeave(true)
    if (!Number.isNaN(parsedUnpaidDays) && parsedUnpaidDays >= 0) setUnpaidLeaveDays(parsedUnpaidDays)
    if (params.get('safebudget') === '1') setUseBudgetSafePaidLeave(true)
    if (params.get('school') === '1') setShowSchoolHolidays(true)
    if (params.get('schoolalign') === '1') setPreferSchoolHolidays(true)
    const parsedCalView = params.get('calview')
    if (parsedCalView === 'combined' || parsedCalView === 'per-member') {
      setCalendarViewMode(parsedCalView)
    }
  }, [])

  useEffect(() => {
    const syncFromPath = () => {
      const path = window.location.pathname
      if (path.startsWith('/guide')) {
        setView('guide')
      } else {
        setView('planner')
      }
    }
    syncFromPath()
    window.addEventListener('popstate', syncFromPath)
    return () => window.removeEventListener('popstate', syncFromPath)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('year', String(year))
    params.set('country', country)
    if (subdivision) params.set('subdivision', subdivision)
    if (startDate) params.set('start', startDate)
    if (mustInclude) params.set('include', mustInclude)
    if (weekendDays.length) params.set('weekend', weekendDays.join(','))
    if (blackoutDates.length) params.set('blackout', blackoutDates.join(','))
    if (members.length) {
      params.set(
        'members',
        members
          .map((m) => `${encodeURIComponent(m.name)}:${m.leaveDays}`)
          .join('|')
      )
    }
    if (calendarFilter) params.set('filter', calendarFilter)
    if (selectedIndex) params.set('option', String(selectedIndex))
    if (plannedLeaveSpend !== null) params.set('spend', String(plannedLeaveSpend))
    if (useUnpaidLeave) {
      params.set('unpaid', '1')
      params.set('unpaidDays', String(unpaidLeaveBudget))
    }
    if (useBudgetSafePaidLeave) params.set('safebudget', '1')
    if (showSchoolHolidays) params.set('school', '1')
    if (preferSchoolHolidays) params.set('schoolalign', '1')
    if (calendarViewMode) params.set('calview', calendarViewMode)
    const basePath = view === 'guide' ? '/guide' : '/'
    const newUrl = `${basePath}?${params.toString()}`
    window.history.replaceState(null, '', newUrl)
  }, [
    year,
    country,
    subdivision,
    startDate,
    mustInclude,
    weekendDays,
    blackoutDates,
    members,
    calendarFilter,
    selectedIndex,
    plannedLeaveSpend,
    useUnpaidLeave,
    unpaidLeaveBudget,
    useBudgetSafePaidLeave,
    showSchoolHolidays,
    preferSchoolHolidays,
    view,
    calendarViewMode,
  ])

  const handleCopyLink = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const handleReset = () => {
    setCountry('au')
    setSubdivision('NSW')
    setYear(2026)
    setHolidays([])
    setResult(null)
    setIsLoading(false)
    setStatus('Ready when you are.')
    setStartDate(getDefaultStartDate(2026))
    setMustInclude('')
    setWeekendDays([6, 0])
    setCopied(false)
    setBlackoutDates([])
    setBlackoutInput('')
    setMembers(DEFAULT_MEMBERS)
    setTopWindows([])
    setSelectedIndex(0)
    setCalendarFilter('all')
    setCurvePoints([])
    setCurveSuggestions([])
    setPlannedLeaveSpend(null)
    setUseUnpaidLeave(false)
    setUnpaidLeaveDays(0)
    setUseBudgetSafePaidLeave(false)
    setShowSchoolHolidays(false)
    setPreferSchoolHolidays(false)
    setSchoolHolidays([])
    setView('planner')
    setCalendarViewMode('combined')
    window.history.pushState(null, '', '/')
  }

  const handleExportIcs = () => {
    if (!result || result.length === 0) return
    const toIcsDate = (iso) => iso.replace(/-/g, '')
    const addDays = (iso, days) => {
      const date = new Date(`${iso}T00:00:00Z`)
      date.setUTCDate(date.getUTCDate() + days)
      return date.toISOString().slice(0, 10)
    }
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d+Z$/, 'Z')

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Optimise Leave//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ]

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:window-${result.windowDates[0]}@optimise-leave`)
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(`DTSTART;VALUE=DATE:${toIcsDate(result.windowDates[0])}`)
    lines.push(`DTEND;VALUE=DATE:${toIcsDate(addDays(result.windowDates.at(-1), 1))}`)
    lines.push('SUMMARY:Leave window')
    lines.push('DESCRIPTION:Optimised leave window.')
    lines.push('END:VEVENT')

    const leaveEvents = [
      ...leaveBreakdown.paidDates.map((date) => ({ date, summary: 'Paid leave' })),
      ...leaveBreakdown.unpaidDates.map((date) => ({ date, summary: 'Unpaid leave' })),
    ]

    leaveEvents.forEach(({ date, summary }, idx) => {
      lines.push('BEGIN:VEVENT')
      lines.push(`UID:leave-${date}-${idx}@optimise-leave`)
      lines.push(`DTSTAMP:${stamp}`)
      lines.push(`DTSTART;VALUE=DATE:${toIcsDate(date)}`)
      lines.push(`DTEND;VALUE=DATE:${toIcsDate(addDays(date, 1))}`)
      lines.push(`SUMMARY:${summary}`)
      lines.push('DESCRIPTION:Planned leave day.')
      lines.push('END:VEVENT')
    })

    lines.push('END:VCALENDAR')
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `leave-plan-${year}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    if (!result || result.length === 0) return
    window.print()
  }

  const applySuggestedLeaveSpend = (leaveDays) => {
    if (!useUnpaidLeave) {
      setPlannedLeaveSpend(leaveDays)
      return
    }

    const nextPaid = Math.min(leaveDays, familyLeaveBudget)
    setPlannedLeaveSpend(nextPaid)
    setUnpaidLeaveDays(Math.max(0, leaveDays - nextPaid))
  }

  return (
    <div className="min-h-screen px-4 py-6 text-sand sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-[88rem] space-y-6 no-print lg:space-y-8">

        {/* ── Header ── */}
        <header className="grid gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] md:items-start">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-primary/[0.08] px-4 py-1.5">
              <span className="size-1.5 rounded-full bg-primary animate-pulsein" />
              <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-primary">Leave Optimizer</span>
            </div>
            <h1 className="font-display text-4xl font-semibold uppercase leading-tight tracking-wide text-sand sm:text-5xl lg:text-6xl">
              Plan your leave<br />around public holidays.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-sand/60 sm:text-base">
              Enter your balance, location, and start date. The planner finds the longest continuous break
              using weekends and public holidays.
            </p>
            <div className="flex flex-wrap gap-2">
              {['planner', 'guide'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setView(tab)
                    const basePath = tab === 'guide' ? '/guide' : '/'
                    window.history.pushState(null, '', basePath + window.location.search)
                  }}
                  className={`rounded-xl border px-4 py-2 text-xs font-medium uppercase tracking-[0.25em] transition-colors ${
                    view === tab ? PILL_ACTIVE : PILL_IDLE
                  }`}
                >
                  {tab === 'planner' ? 'Planner' : 'How it works'}
                </button>
              ))}
              <button
                type="button"
                onClick={handleReset}
                className={`rounded-xl border px-4 py-2 text-xs font-medium uppercase tracking-[0.25em] transition-colors ${PILL_IDLE}`}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Status card */}
          <div className={`${CARD} p-6`}>
            <div className={LABEL_CLS}>Status</div>
            <div className="mt-3 font-display text-xl font-medium text-primary">{status}</div>
            <div className="mt-4 h-px bg-l3" />
            <div className="mt-4 font-mono text-[11px] text-sand/40">
              holiday data · public/data/
            </div>
            {isLoading && (
              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-l3">
                <div className="h-full w-1/3 animate-pulsein rounded-full bg-primary" />
              </div>
            )}
          </div>
        </header>

        {/* ── Guide view ── */}
        {view === 'guide' ? (
          <section className={`${CARD} p-8 animate-floatup`}>
            <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-sand">
              How to use this planner
            </h2>
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              <div className="space-y-6 text-sm text-sand/60">
                {[
                  ['1 - Set your region', 'Choose the year, country, and state or region. The planner loads holidays for the selected year and the following year, so a late-December break can continue into January.'],
                  ['2 - Pick your start date', '"Consider Leave From" defaults to today and limits the search to dates on or after that day. Use "Must Include" when the break must cover a specific date.'],
                  ['3 - Set leave capacity', 'Enter paid leave days first. Turn on unpaid leave only when you are willing to add extra unpaid days; paid leave is used before unpaid leave.'],
                ].map(([title, body]) => (
                  <div key={title}>
                    <div className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-sand">{title}</div>
                    <p>{body}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-6 text-sm text-sand/60">
                {[
                  ['4 - Use advanced options', 'Open Work Weekend, Family Members, or Blackout Dates only when needed. Family planning uses the lowest paid-leave balance across members.'],
                  ['5 - Compare the result', 'After calculating, Top Options shows alternative windows. The main result separates paid leave, unpaid leave, weekends, and public holidays.'],
                  ['6 - Review calendar and analysis', 'The calendar focuses on the month or months in the selected window, including cross-year windows. Expand Tradeoff Curve or Multiple Best Windows for deeper comparisons.'],
                ].map(([title, body]) => (
                  <div key={title}>
                    <div className="mb-2 font-display text-sm font-semibold uppercase tracking-wide text-sand">{title}</div>
                    <p>{body}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className={`mt-8 ${PANEL}`}>
              <p className="text-xs text-sand/50">
                Tip: Use "Copy shareable plan link" to send your exact setup to someone else.
              </p>
            </div>
          </section>
        ) : (
          /* ── Planner view ── */
          <section className="grid gap-5 lg:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.42fr)] lg:items-start xl:grid-cols-[minmax(340px,0.72fr)_minmax(0,1.58fr)]">

            {/* ─ Inputs ─ */}
            <div className={`${CARD} p-5 sm:p-6 lg:sticky lg:top-6`}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className={LABEL_CLS}>Planner setup</div>
                  <h2 className="mt-1 font-display text-2xl font-semibold uppercase tracking-wide text-sand">
                    Inputs
                  </h2>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-right">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-primary/70">Capacity</div>
                  <div className="font-display text-xl text-primary">{totalLeaveBudget} days</div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:col-start-1 lg:row-start-2 lg:mt-0 lg:grid-cols-1 xl:grid-cols-2">
                <label className="space-y-2">
                  <span className={LABEL_CLS}>Year</span>
                  <select
                    value={year}
                    onChange={(e) => {
                      const y = Number(e.target.value)
                      setYear(y)
                      setStartDate(getDefaultStartDate(y))
                    }}
                    className={INPUT_CLS}
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className={LABEL_CLS}>Consider Leave From</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={INPUT_CLS}
                  />
                </label>

                <label className="space-y-2">
                  <span className={LABEL_CLS}>Must Include (Optional)</span>
                  <input
                    type="date"
                    value={mustInclude}
                    onChange={(e) => setMustInclude(e.target.value)}
                    className={INPUT_CLS}
                  />
                  <span className="text-[11px] text-sand/40">Ignored if before start date.</span>
                </label>

                <label className="space-y-2">
                  <span className={LABEL_CLS}>Country</span>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className={INPUT_CLS}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className={LABEL_CLS}>State / Region</span>
                  <select
                    value={subdivision}
                    onChange={(e) => setSubdivision(e.target.value)}
                    disabled={countryInfo.subdivisions.length === 0}
                    className={`${INPUT_CLS} disabled:opacity-40`}
                  >
                    {countryInfo.subdivisions.length === 0 && <option>National</option>}
                    {countryInfo.subdivisions.map((s) => (
                      <option key={s.code} value={s.code}>{s.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Weekend */}
              <details className={`mt-5 ${PANEL}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className={LABEL_CLS}>Work Weekend</span>
                  <span className="text-[10px] uppercase tracking-[0.3em] text-sand/40">Expand</span>
                </summary>
                <div className="mt-4 flex flex-wrap gap-3">
                  {WEEKDAYS.map((day) => {
                    const checked = weekendDays.includes(day.value)
                    return (
                      <label key={day.value} className="flex cursor-pointer items-center gap-2 text-sm text-sand/70">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setWeekendDays((prev) => [...new Set([...prev, day.value])])
                            } else {
                              setWeekendDays((prev) => prev.filter((d) => d !== day.value))
                            }
                          }}
                          className="h-4 w-4 rounded border-l3 accent-primary focus:ring-primary/40"
                        />
                        {day.label}
                      </label>
                    )
                  })}
                </div>
              </details>

              {/* Family members */}
              <details className={`mt-4 ${PANEL}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className={LABEL_CLS}>Family Members</span>
                  <span className="text-[10px] uppercase tracking-[0.3em] text-sand/40">Expand</span>
                </summary>
                <div className="mt-4 space-y-3">
                  {members.map((member) => (
                    <div key={member.id} className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) =>
                          setMembers((prev) =>
                            prev.map((m) => (m.id === member.id ? { ...m, name: e.target.value } : m))
                          )
                        }
                        className="min-w-[140px] flex-1 rounded-xl border border-l3 bg-l1 px-3 py-2 text-sm text-sand placeholder:text-sand/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
                        placeholder="Name"
                      />
                      <input
                        type="number"
                        min="0"
                        value={member.leaveDays}
                        onChange={(e) =>
                          setMembers((prev) =>
                            prev.map((m) =>
                              m.id === member.id ? { ...m, leaveDays: e.target.value } : m
                            )
                          )
                        }
                        className="w-24 rounded-xl border border-l3 bg-l1 px-3 py-2 text-sm text-sand placeholder:text-sand/30 focus:outline-none focus:ring-2 focus:ring-primary/40"
                        placeholder="Days"
                      />
                      {members.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setMembers((prev) => prev.filter((m) => m.id !== member.id))}
                          className="rounded-xl border border-l3 bg-l2 px-3 py-2 text-xs text-sand/50 hover:text-sand/80 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-sand/40">
                    Family budget: <span className="text-sand/70">{familyLeaveBudget} days</span> (min across members)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setMembers((prev) => [
                        ...prev,
                        { id: Date.now(), name: `Member ${prev.length + 1}`, leaveDays: 10 },
                      ])
                    }
                    className={`rounded-xl border px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] transition-colors ${PILL_IDLE}`}
                  >
                    + Add member
                  </button>
                </div>
              </details>

              {/* Planned leave spend */}
              <div className={`mt-4 ${PANEL}`}>
                <div className={LABEL_CLS}>Leave Spend</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-[11px] text-sand/40">Paid leave days</span>
                    <input
                      type="number"
                      min="0"
                      value={plannedLeaveSpend ?? ''}
                      onChange={(e) => {
                        const value = e.target.value
                        setPlannedLeaveSpend(value === '' ? null : Number(value))
                      }}
                      className="w-full rounded-xl border border-l3 bg-l1 px-3 py-2 text-sm text-sand focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-l3 bg-l1 px-3 py-2 text-sm text-sand/70">
                    <input
                      type="checkbox"
                      checked={useUnpaidLeave}
                      onChange={(e) => setUseUnpaidLeave(e.target.checked)}
                      className="h-4 w-4 rounded border-l3 accent-primary focus:ring-primary/40"
                    />
                    Include unpaid leave
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-l3 bg-l1 px-3 py-2 text-sm text-sand/70">
                    <input
                      type="checkbox"
                      checked={useBudgetSafePaidLeave}
                      onChange={(e) => setUseBudgetSafePaidLeave(e.target.checked)}
                      className="h-4 w-4 rounded border-l3 accent-primary focus:ring-primary/40"
                    />
                    Budget-safe paid leave
                  </label>
                  <label className={`space-y-1 ${useUnpaidLeave ? '' : 'opacity-40'}`}>
                    <span className="text-[11px] text-sand/40">Unpaid leave days</span>
                    <input
                      type="number"
                      min="0"
                      value={unpaidLeaveDays}
                      disabled={!useUnpaidLeave}
                      onChange={(e) => setUnpaidLeaveDays(toNonNegativeNumber(e.target.value))}
                      className="w-full rounded-xl border border-l3 bg-l1 px-3 py-2 text-sm text-sand focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed"
                    />
                  </label>
                  <div className="rounded-xl border border-l3 bg-l1 px-3 py-2 text-xs text-sand/40">
                    <div>Paid available: <span className="text-sand/70">{familyLeaveBudget} days</span></div>
                    <div>Paid counted: <span className="text-sand/70">{effectivePaidLeaveBudget} days</span></div>
                    <div>Total capacity: <span className="text-sand/70">{totalLeaveBudget} days</span></div>
                    {reallocatedUnpaidBudget > 0 && (
                      <div>Moved to unpaid: <span className="text-sand/70">{reallocatedUnpaidBudget} days</span></div>
                    )}
                  </div>
                  {paidLeaveBudget > familyLeaveBudget && !useBudgetSafePaidLeave && (
                    <span className="rounded-md border border-blood/30 bg-blood/10 px-2 py-0.5 text-xs text-blood">
                      Paid leave over budget
                    </span>
                  )}
                  {paidLeaveBudget > familyLeaveBudget && useBudgetSafePaidLeave && !useUnpaidLeave && (
                    <span className="rounded-md border border-moss/30 bg-moss/10 px-2 py-0.5 text-xs text-moss">
                      Extra paid leave ignored
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-sand/40">
                  Paid leave is used first. Budget-safe mode caps paid days at the lowest family balance.
                </p>
              </div>

              {/* Blackout dates */}
              <details className={`mt-4 ${PANEL}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className={LABEL_CLS}>Blackout Dates</span>
                  <span className="text-[10px] uppercase tracking-[0.3em] text-sand/40">Expand</span>
                </summary>
                <div className="mt-3 flex flex-wrap gap-2">
                  {blackoutDates.length === 0 && (
                    <span className="text-xs text-sand/40">No blackout dates.</span>
                  )}
                  {blackoutDates.map((date) => (
                    <button
                      type="button"
                      key={date}
                      onClick={() => setBlackoutDates((prev) => prev.filter((d) => d !== date))}
                      className="rounded-lg border border-blood/20 bg-blood/10 px-3 py-1 text-xs text-blood/80 hover:border-blood/40 transition-colors"
                    >
                      {date} ×
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    type="date"
                    value={blackoutInput}
                    onChange={(e) => setBlackoutInput(e.target.value)}
                    className="w-full rounded-xl border border-l3 bg-l1 px-4 py-2 text-sm text-sand focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!blackoutInput) return
                      setBlackoutDates((prev) => [...new Set([...prev, blackoutInput])])
                      setBlackoutInput('')
                    }}
                    className={`rounded-xl border px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] transition-colors ${PILL_IDLE}`}
                  >
                    Add
                  </button>
                </div>
              </details>

              {/* School holidays */}
              <details className={`mt-4 ${PANEL}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <span className={LABEL_CLS}>School Holidays</span>
                  <span className="text-[10px] uppercase tracking-[0.3em] text-sand/40">Expand</span>
                </summary>
                <div className="mt-4 space-y-3">
                  <label className={`flex items-center gap-3 rounded-xl border border-l3 bg-l1 px-3 py-2 text-sm text-sand/70 ${country === 'au' ? '' : 'opacity-40'}`}>
                    <input
                      type="checkbox"
                      checked={showSchoolHolidays}
                      disabled={country !== 'au'}
                      onChange={(e) => setShowSchoolHolidays(e.target.checked)}
                      className="h-4 w-4 rounded border-l3 accent-primary focus:ring-primary/40 disabled:cursor-not-allowed"
                    />
                    Show Australian school holidays
                  </label>
                  <label className={`flex items-center gap-3 rounded-xl border border-l3 bg-l1 px-3 py-2 text-sm text-sand/70 ${country === 'au' ? '' : 'opacity-40'}`}>
                    <input
                      type="checkbox"
                      checked={preferSchoolHolidays}
                      disabled={country !== 'au'}
                      onChange={(e) => {
                        setPreferSchoolHolidays(e.target.checked)
                        if (e.target.checked) setShowSchoolHolidays(true)
                      }}
                      className="h-4 w-4 rounded border-l3 accent-primary focus:ring-primary/40 disabled:cursor-not-allowed"
                    />
                    Prefer windows that overlap school holidays
                  </label>
                  <p className="text-[11px] text-sand/40">
                    Uses state school holiday ranges where local data is available.
                  </p>
                </div>
              </details>

              <button
                type="button"
                disabled={!canProceed || isLoading}
                onClick={() => handleCompute(selectedIndex)}
                className="mt-6 w-full rounded-xl bg-primary px-6 py-4 text-sm font-semibold uppercase tracking-[0.25em] text-ink shadow-glow transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isLoading ? 'Calculating…' : 'Find Best Window'}
              </button>
            </div>

            {/* ─ Results ─ */}
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className={`${PANEL} xl:col-span-2`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className={LABEL_CLS}>Top Options</div>
                    {topWindows.length ? (
                      <span className="font-mono text-[10px] text-sand/35">{topWindows.length} found</span>
                    ) : null}
                  </div>
                  {topWindows.length ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                      {topWindows.map((win, idx) => (
                        <button
                          type="button"
                          key={`${win.start}-${win.end}`}
                          onClick={() => {
                            setSelectedIndex(idx)
                            setResult(win)
                          }}
                          className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                            idx === selectedIndex ? PILL_ACTIVE : PILL_IDLE
                          }`}
                        >
                          <div className="text-sm font-semibold">
                            Option {idx + 1} <span className={idx === selectedIndex ? 'text-primary' : ''}>{win.length}d</span>
                          </div>
                          <div className="mt-1 font-mono text-[10px] leading-relaxed text-sand/50">
                            {win.windowDates[0]} to {win.windowDates.at(-1)}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-sand/45">Run the planner to compare windows here.</p>
                  )}
                </div>

                <div className={PANEL}>
                  <div className={LABEL_CLS}>Data</div>
                  <ul className="mt-3 space-y-2 text-sm">
                    {[
                      ['Region', countryInfo.subdivisions.length ? subdivision : countryInfo.name],
                      ['Loaded', `${holidays.length} rows`],
                      ['School rows', schoolOverlayEnabled ? String(schoolHolidays.length) : 'Off'],
                      ['Members', String(members.length)],
                    ].map(([k, v]) => (
                      <li key={k} className="flex items-center justify-between gap-3">
                        <span className="text-sand/40">{k}</span>
                        <span className="truncate font-mono text-xs text-sand/70">{v}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={PANEL}>
                  <div className={LABEL_CLS}>Share</div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`mt-3 w-full rounded-xl border py-3 text-xs font-medium uppercase tracking-[0.18em] transition-colors ${
                      copied ? 'border-primary/50 bg-primary/10 text-primary' : PILL_IDLE
                    }`}
                  >
                    {copied ? 'Copied' : 'Copy Link'}
                  </button>
                </div>
              </div>

            <div className="grid gap-5 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:grid-cols-2">

              {/* Optimal window */}
              <div className={`${CARD} p-5 sm:p-6 lg:col-span-2`}>
                <h3 className="font-display text-xl font-semibold uppercase tracking-wide text-sand">
                  Optimal Window
                </h3>
                {result ? (
                  <div className="mt-5 grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
                    <div className="flex min-h-48 flex-col justify-between rounded-2xl border border-primary/20 bg-primary/[0.07] p-5">
                      <div className={LABEL_CLS}>Best break</div>
                      <div className="font-display text-6xl font-semibold leading-none text-primary sm:text-7xl">
                        {result.length}
                        <span className="ml-2 align-baseline text-2xl font-medium text-primary/70">days</span>
                      </div>
                      {result.length > 0 ? (
                        <div className="font-mono text-xs text-sand/70">
                          {result.windowDates[0]} to {result.windowDates.at(-1)}
                        </div>
                      ) : (
                        <div className="text-sm text-sand/50">No valid window found.</div>
                      )}
                    </div>

                    <div className={`${PANEL} space-y-2 text-sm`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sand/50">Leave used (per person)</span>
                        <span className="font-medium text-sand">{result.leaveUsed} / {totalLeaveBudget}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sand/50">Paid leave</span>
                        <span className="font-medium text-sand">{leaveBreakdown.paidUsed} / {paidLeaveBudget}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sand/50">Unpaid leave</span>
                        <span className="font-medium text-sand">{leaveBreakdown.unpaidUsed} / {unpaidLeaveBudget}</span>
                      </div>
                      {result.length > 0 ? (
                        <div className="flex items-center justify-between">
                          <span className="text-sand/50">Window</span>
                          <span className="font-mono text-xs text-sand/80">
                            {result.windowDates[0]} → {result.windowDates.at(-1)}
                          </span>
                        </div>
                      ) : (
                        <div className="text-sand/50">No valid window found from the selected start date.</div>
                      )}
                      <div className="flex gap-4 pt-1 text-xs text-sand/50">
                        <span>Weekends: <span className="text-sand/70">{counts.weekends}</span></span>
                        <span>Holidays: <span className="text-sand/70">{counts.holidays}</span></span>
                        {schoolOverlayEnabled && (
                          <span>School: <span className="text-sand/70">{counts.school}</span></span>
                        )}
                        <span>Paid: <span className="text-sand/70">{counts.leave - counts.unpaid}</span></span>
                        <span>Unpaid: <span className="text-sand/70">{counts.unpaid}</span></span>
                      </div>
                    </div>

                    <div className={`${PANEL} xl:col-span-2`}>
                      <div className={`${LABEL_CLS} mb-2`}>Leave dates</div>
                      <p className="font-mono text-[11px] leading-relaxed text-sand/60">
                        {result.leaveDates.length ? result.leaveDates.join(', ') : 'No leave days required'}
                      </p>
                      {leaveBreakdown.unpaidDates.length ? (
                        <p className="mt-2 font-mono text-[11px] leading-relaxed text-blood/80">
                          Unpaid: {leaveBreakdown.unpaidDates.join(', ')}
                        </p>
                      ) : null}
                    </div>

                    <div className={`${PANEL} xl:col-span-2`}>
                      <div className={`${LABEL_CLS} mb-3`}>Per-member plan</div>
                      <div className="space-y-2">
                        {perMemberPlan.map((m) => (
                          <div key={m.id} className="flex items-center justify-between text-sm">
                            <span className="text-sand/70">{m.name}</span>
                            <span className={`font-mono text-xs ${m.remaining < 0 ? 'text-blood' : 'text-sand/80'}`}>
                              {m.used} paid / {m.unpaid} unpaid / {m.remaining} left
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1 xl:col-span-2">
                      <button
                        type="button"
                        disabled={!canExport}
                        onClick={handleExportIcs}
                        className={`rounded-xl border px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] transition-colors disabled:opacity-40 ${PILL_IDLE}`}
                      >
                        Download .ics
                      </button>
                      <button
                        type="button"
                        disabled={!canExport}
                        onClick={handlePrint}
                        className={`rounded-xl border px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] transition-colors disabled:opacity-40 ${PILL_IDLE}`}
                      >
                        Print summary
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-sand/50">Enter your inputs to see the optimal break.</p>
                )}
              </div>

              {/* Tradeoff curve */}
              <details className={`${CARD} p-5 sm:p-6`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <div>
                <h3 className="font-display text-xl font-semibold uppercase tracking-wide text-sand">
                  Leave Tradeoff Curve
                </h3>
                <p className="mt-1 text-xs text-sand/50">
                  Days off vs leave used (0 → {curveSummary.maxLeave}). Click a suggestion to apply it.
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.3em] text-sand/40">Expand</span>
                </summary>
                <div className={`mt-4 ${PANEL} p-4`}>
                  {curvePoints.length ? (
                    <CurveChart points={curvePoints} suggestions={curveSuggestions} />
                  ) : (
                    <div className="py-4 text-center text-xs text-sand/40">Run the planner to see the curve.</div>
                  )}
                </div>
                {tradeoffInsights.bestJumps.length ? (
                  <div className={`mt-4 ${PANEL}`}>
                    <div className={`${LABEL_CLS} mb-2`}>Best marginal gains</div>
                    <div className="flex flex-wrap gap-3 text-xs text-sand/60">
                      {tradeoffInsights.bestJumps.map((j) => (
                        <span key={`${j.from}-${j.to}`} className="font-mono">
                          {j.from}→{j.to} leave: <span className="text-primary">+{j.gain}d</span>
                        </span>
                      ))}
                    </div>
                    {tradeoffInsights.diminishing ? (
                      <p className="mt-2 text-[11px] text-sand/40">
                        Diminishing returns around {tradeoffInsights.diminishing.to} leave (+{tradeoffInsights.diminishing.gain} day).
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {curveSuggestions.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`${LABEL_CLS} self-center`}>Suggestions</span>
                    {curveSuggestions.map((s) => (
                      <button
                        type="button"
                        key={s.leave}
                        onClick={() => {
                          applySuggestedLeaveSpend(s.leave)
                          handleCompute(0, s.leave)
                        }}
                        className={`rounded-lg border px-3 py-1 text-xs transition-colors ${PILL_IDLE}`}
                      >
                        {s.leave} leave → {s.daysOff} off
                      </button>
                    ))}
                  </div>
                ) : null}
              </details>

              {/* Top options */}
              <div className={`${CARD} hidden p-6`}>
                <h3 className="font-display text-xl font-semibold uppercase tracking-wide text-sand">
                  Top Options
                </h3>
                {topWindows.length ? (
                  <div className="mt-4 space-y-2">
                    {topWindows.map((win, idx) => (
                      <button
                        type="button"
                        key={`${win.start}-${win.end}`}
                        onClick={() => {
                          setSelectedIndex(idx)
                          setResult(win)
                        }}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                          idx === selectedIndex ? PILL_ACTIVE : PILL_IDLE
                        }`}
                      >
                        <div className="text-sm font-semibold">
                          Option {idx + 1} — <span className={idx === selectedIndex ? 'text-primary' : ''}>{win.length} days off</span>
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-sand/50">
                          {win.windowDates[0]} → {win.windowDates.at(-1)}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-sand/50">No options computed yet.</p>
                )}
              </div>

              {/* Multiple best windows (expandable) */}
              <details className={`${CARD} p-5 sm:p-6`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <h3 className="font-display text-xl font-semibold uppercase tracking-wide text-sand">
                    Multiple Best Windows
                  </h3>
                  <span className="text-[10px] uppercase tracking-[0.3em] text-sand/40">Expand</span>
                </summary>
                {curveSuggestions.length ? (
                  <div className="mt-5 space-y-4">
                    {curveSuggestions.map((s) => (
                      <div key={s.leave} className={PANEL}>
                        <div className={`${LABEL_CLS} mb-3`}>
                          {s.leave} leave → {s.daysOff} off
                        </div>
                        <div className="space-y-2">
                          {(suggestionWindows[s.leave] || []).map((win, idx) => (
                            <button
                              key={`${s.leave}-${win.start}-${idx}`}
                              type="button"
                              onClick={() => {
                                applySuggestedLeaveSpend(s.leave)
                                setSelectedIndex(0)
                                setResult(win)
                              }}
                              className="w-full rounded-lg border border-l3 bg-l1 px-3 py-2 text-left text-xs text-sand/60 hover:border-primary/30 hover:text-sand/90 transition-colors"
                            >
                              Option {idx + 1}: {win.windowDates[0]} → {win.windowDates.at(-1)} ({win.length} days)
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-sand/50">Run the planner to see grouped options.</p>
                )}
              </details>

              {/* Data status + share */}
              <div className={`${CARD} hidden p-6`}>
                <h3 className="font-display text-xl font-semibold uppercase tracking-wide text-sand">
                  Data Status
                </h3>
                <ul className="mt-4 space-y-2 text-sm">
                  {[
                    ['Country', countryInfo.name],
                    ['State', countryInfo.subdivisions.length ? subdivision : 'National'],
                    ['File', `/public/data/holidays-${country}-${year}.csv`],
                    ['Loaded', `${holidays.length} rows`],
                    ['Members', String(members.length)],
                  ].map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between">
                      <span className="text-sand/40">{k}</span>
                      <span className="font-mono text-xs text-sand/70">{v}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`mt-5 w-full rounded-xl border py-3 text-xs font-medium uppercase tracking-[0.2em] transition-colors ${
                    copied ? 'border-primary/50 bg-primary/10 text-primary' : PILL_IDLE
                  }`}
                >
                  {copied ? 'Link copied!' : 'Copy shareable plan link'}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── Calendar ── */}
        {view === 'planner' && (
          <section className={`${CARD} p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="font-display text-2xl font-semibold uppercase tracking-wide text-sand">
                Calendar View
              </h2>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Holiday', color: 'border-sky/40 bg-sky/10 text-sky' },
                  ...(schoolOverlayEnabled
                    ? [{ label: 'School break', color: 'border-moss/40 bg-moss/10 text-moss' }]
                    : []),
                  { label: 'Paid leave', color: 'border-primary/60 bg-primary/20 text-primary' },
                  { label: 'Unpaid leave', color: 'border-blood/40 bg-blood/10 text-blood' },
                  { label: 'Weekend', color: 'border-l3 bg-l2 text-sand/60' },
                  { label: 'Blackout', color: 'border-blood/40 bg-blood/10 text-blood' },
                ].map(({ label, color }) => (
                  <span key={label} className={`rounded-lg border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] ${color}`}>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`${LABEL_CLS} self-center`}>Filter</span>
              {['all', 'window', 'off'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCalendarFilter(mode)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] transition-colors ${
                    calendarFilter === mode ? PILL_ACTIVE : PILL_IDLE
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`${LABEL_CLS} self-center`}>View</span>
              {['combined', 'per-member'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCalendarViewMode(mode)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] transition-colors ${
                    calendarViewMode === mode ? PILL_ACTIVE : PILL_IDLE
                  }`}
                >
                  {mode === 'combined' ? 'Combined' : 'Per member'}
                </button>
              ))}
            </div>

            <div className="mt-8">
              {calendarViewMode === 'combined' ? (
                <Calendar
                  year={year}
                  dayMeta={dayMeta}
                  filterMode={calendarFilter}
                  idPrefix="main"
                  visibleMonths={visibleCalendarMonths}
                />
              ) : (
                <div className="space-y-4">
                  {members.map((member) => {
                    const balance = toNonNegativeNumber(member.leaveDays)
                    const used = leaveBreakdown.paidUsed
                    const unpaid = leaveBreakdown.unpaidUsed
                    const remaining = balance - used
                    return (
                      <details
                        key={member.id}
                        className={PANEL}
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between text-sm">
                          <span className="font-medium text-sand/80">{member.name}</span>
                          <span className={`font-mono text-xs ${remaining < 0 ? 'text-blood' : 'text-sand/50'}`}>
                            {used} paid / {unpaid} unpaid / {remaining} left
                          </span>
                        </summary>
                        <div className="mt-4">
                          <Calendar
                            year={year}
                            dayMeta={dayMeta}
                            filterMode={calendarFilter}
                            idPrefix={`member-${member.id}`}
                            visibleMonths={visibleCalendarMonths}
                          />
                        </div>
                      </details>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* ── Print root ── */}
      <div id="print-root" className="print-root">
        <div className="print-card">
          <h1>Leave Plan Summary</h1>
          <p>
            {countryInfo.name}
            {countryInfo.subdivisions.length ? ` · ${subdivision}` : ''} · {year}
          </p>
          {result ? (
            <>
              <p>
                Window: {result.windowDates[0]} → {result.windowDates.at(-1)} ({result.length} days off)
              </p>
              <p>Leave used per person: {result.leaveUsed}</p>
              <p>Paid leave: {leaveBreakdown.paidUsed}</p>
              <p>Unpaid leave: {leaveBreakdown.unpaidUsed}</p>
              <p>Leave dates: {result.leaveDates.join(', ') || 'None'}</p>
              <h2>Per-member balances</h2>
              <ul>
                {perMemberPlan.map((m) => (
                  <li key={m.id}>
                    {m.name}: {m.used} paid / {m.unpaid} unpaid / {m.remaining} left
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>No plan computed.</p>
          )}
        </div>
      </div>
    </div>
  )
}

const CurveChart = ({ points, suggestions = [] }) => {
  const width = 520
  const height = 180
  const padding = 24
  const maxX = Math.max(...points.map((p) => p.leave), 1)
  const maxY = Math.max(...points.map((p) => p.daysOff), 1)
  const scaleX = (x) => padding + (x / maxX) * (width - padding * 2)
  const scaleY = (y) => height - padding - (y / maxY) * (height - padding * 2)

  const stepPath = points
    .map((p, idx) => {
      if (idx === 0) return `M ${scaleX(p.leave)} ${scaleY(p.daysOff)}`
      const prev = points[idx - 1]
      const x = scaleX(p.leave)
      const y = scaleY(p.daysOff)
      const prevX = scaleX(prev.leave)
      const prevY = scaleY(prev.daysOff)
      return `L ${x} ${prevY} L ${x} ${y}`
    })
    .join(' ')

  const ticks = [0, Math.round(maxX / 2), maxX]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <rect x="0" y="0" width={width} height={height} rx="12" fill="rgba(255,255,255,0.01)" />
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={padding}
          y1={scaleY(maxY * t)}
          x2={width - padding}
          y2={scaleY(maxY * t)}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1"
        />
      ))}
      {/* Step path with fill */}
      <path
        d={`${stepPath} L ${scaleX(points.at(-1).leave)} ${height - padding} L ${scaleX(0)} ${height - padding} Z`}
        fill="rgba(0,189,125,0.06)"
      />
      <path d={stepPath} fill="none" stroke="#00BD7D" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p) => (
        <circle key={p.leave} cx={scaleX(p.leave)} cy={scaleY(p.daysOff)} r="2.5" fill="#60B9F0" />
      ))}
      {suggestions.map((p) => (
        <g key={`s-${p.leave}`}>
          <circle cx={scaleX(p.leave)} cy={scaleY(p.daysOff)} r="5" fill="rgba(220,38,38,0.3)" />
          <text x={scaleX(p.leave)} y={scaleY(p.daysOff) - 9} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.6)">
            {p.leave}/{p.daysOff}
          </text>
        </g>
      ))}
      {ticks.map((t) => (
        <text key={t} x={scaleX(t)} y={height - 6} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.35)">
          {t}
        </text>
      ))}
      <text x={padding} y={14} fontSize="9" fill="rgba(255,255,255,0.35)">Days off</text>
    </svg>
  )
}

const getCurveSuggestions = (points) => {
  if (!points.length) return []
  const efficiency = points
    .filter((p) => p.leave > 0)
    .map((p) => ({ ...p, ratio: p.daysOff / p.leave }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 3)

  let knee = null
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]
    const secondDiff = next.daysOff - 2 * curr.daysOff + prev.daysOff
    if (!knee || secondDiff < knee.score) {
      knee = { leave: curr.leave, daysOff: curr.daysOff, score: secondDiff }
    }
  }

  const picks = [...efficiency]
  if (knee) picks.push({ leave: knee.leave, daysOff: knee.daysOff })

  const unique = []
  const seen = new Set()
  picks.forEach((p) => {
    const key = `${p.leave}-${p.daysOff}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push({ leave: p.leave, daysOff: p.daysOff })
    }
  })
  return unique.slice(0, 4)
}

export default App
