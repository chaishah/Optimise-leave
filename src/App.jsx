import { useEffect, useMemo, useState } from 'react'
import Calendar from './components/Calendar.jsx'
import { loadHolidays } from './lib/holidayLoader.js'
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

const App = () => {
  const [country, setCountry] = useState('au')
  const [subdivision, setSubdivision] = useState('NSW')
  const [year, setYear] = useState(2026)
  const [holidays, setHolidays] = useState([])
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState('Ready when you are.')
  const [startDate, setStartDate] = useState('2026-01-01')
  const [mustInclude, setMustInclude] = useState('')
  const [weekendDays, setWeekendDays] = useState([6, 0])
  const [copied, setCopied] = useState(false)
  const [blackoutDates, setBlackoutDates] = useState([])
  const [blackoutInput, setBlackoutInput] = useState('')
  const [members, setMembers] = useState([{ id: 1, name: 'You', leaveDays: 12 }])
  const [topWindows, setTopWindows] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [calendarFilter, setCalendarFilter] = useState('all')
  const [curvePoints, setCurvePoints] = useState([])
  const [curveSuggestions, setCurveSuggestions] = useState([])
  const [plannedLeaveSpend, setPlannedLeaveSpend] = useState(null)

  const countryInfo = COUNTRIES.find((c) => c.code === country)

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
    const days = buildDayMap(year, holidays, weekendDays)
    const blackoutSet = new Set(blackoutDates)
    const leaveSet = new Set(result?.leaveDates || [])
    const windowSet = new Set(result?.windowDates || [])
    const meta = {}
    days.forEach((day) => {
      meta[day.iso] = {
        isWeekend: day.weekend,
        isHoliday: Boolean(day.holiday),
        isLeave: leaveSet.has(day.iso),
        isWindow: windowSet.has(day.iso),
        isBlocked: blackoutSet.has(day.iso),
        label: day.holiday?.name || '',
      }
    })
    return meta
  }, [year, holidays, result, weekendDays, blackoutDates])

  const handleCompute = async (preferredIndex = 0, spendOverride) => {
    setIsLoading(true)
    setStatus('Loading holidays...')
    const list = await loadHolidays({ country, year, subdivision })
    setHolidays(list)

    if (list.length === 0) {
      setStatus('No holidays loaded. Populate the CSV to unlock accurate results.')
    } else {
      setStatus(`Loaded ${list.length} holidays. Optimizing...`)
    }

    const days = buildDayMap(year, list, weekendDays)
    const blackoutSet = new Set(blackoutDates)
    const daysWithBlocks = days.map((d) => ({ ...d, isBlocked: blackoutSet.has(d.iso) }))
    const filteredWithBlocks = daysWithBlocks.filter((d) => d.iso >= startDate)
    const includeDate = mustInclude && mustInclude >= startDate ? mustInclude : ''
    const maxBudget = Math.min(...members.map((m) => Number(m.leaveDays) || 0))
    const spend = typeof spendOverride === 'number' ? spendOverride : plannedLeaveSpend
    const leaveBudget = Math.max(0, Number.isFinite(spend) ? spend : maxBudget)
    const windows = findTopWindows(filteredWithBlocks, Number(leaveBudget), includeDate, 5)
    setTopWindows(windows)
    const nextIndex = windows[preferredIndex] ? preferredIndex : 0
    const selected = windows[nextIndex] || windows[0] || null
    setSelectedIndex(nextIndex)
    setResult(selected || findOptimalWindow(filteredWithBlocks, Number(leaveBudget), includeDate))
    const curve = []
    const maxCurve = Math.max(maxBudget, leaveBudget, 1)
    for (let i = 0; i <= maxCurve; i += 1) {
      const best = findTopWindows(filteredWithBlocks, i, includeDate, 1)[0]
      curve.push({ leave: i, daysOff: best ? best.length : 0 })
    }
    setCurvePoints(curve)
    const suggestions = getCurveSuggestions(curve)
    setCurveSuggestions(suggestions)
    setIsLoading(false)
  }

  const familyLeaveBudget = useMemo(() => {
    if (!members.length) return 0
    return Math.min(...members.map((m) => Number(m.leaveDays) || 0))
  }, [members])

  useEffect(() => {
    setPlannedLeaveSpend((prev) => {
      if (prev === null) return familyLeaveBudget
      return prev
    })
  }, [familyLeaveBudget])

  const canProceed = familyLeaveBudget > 0 && startDate

  const counts = useMemo(() => {
    if (!result || result.length === 0) {
      return { weekends: 0, holidays: 0, leave: 0 }
    }
    const windowSet = new Set(result.windowDates)
    let weekends = 0
    let holidaysCount = 0
    let leave = 0
    Object.entries(dayMeta).forEach(([iso, meta]) => {
      if (!windowSet.has(iso)) return
      if (meta.isWeekend) weekends += 1
      if (meta.isHoliday) holidaysCount += 1
      if (meta.isLeave) leave += 1
    })
    return { weekends, holidays: holidaysCount, leave }
  }, [dayMeta, result])

  const curveSummary = useMemo(() => {
    if (!curvePoints.length) return { maxLeave: 0, maxDays: 0 }
    const last = curvePoints[curvePoints.length - 1]
    return { maxLeave: last.leave, maxDays: last.daysOff }
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
    const newUrl = `${window.location.pathname}?${params.toString()}`
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

  return (
    <div className="min-h-screen px-4 py-10 text-sand">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="grid gap-4 md:grid-cols-[1.2fr_1fr] md:items-end">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.35em] text-sand/60">
              Leave Optimizer
            </div>
            <h1 className="font-display text-4xl md:text-5xl text-sand">
              Plan your leave around public holidays.
            </h1>
            <p className="text-sand/70">
              Enter your balance, location, and start date. The planner finds the longest continuous break
              using weekends and public holidays.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-loud">
            <div className="text-xs uppercase tracking-[0.35em] text-sand/50">Status</div>
            <div className="mt-2 text-lg font-semibold text-acid">{status}</div>
            <div className="mt-3 text-xs text-sand/60">
              Holiday data is loaded from `public/data/`.
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-loud">
            <h2 className="font-display text-2xl text-sand">Inputs</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.3em] text-sand/50">Year</span>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full rounded-2xl border border-white/10 bg-ink px-4 py-3 text-lg text-sand focus:outline-none focus:ring-2 focus:ring-acid"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.3em] text-sand/50">Consider Leave From</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-ink px-4 py-3 text-lg text-sand focus:outline-none focus:ring-2 focus:ring-acid"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.3em] text-sand/50">Must Include (Optional)</span>
                <input
                  type="date"
                  value={mustInclude}
                  onChange={(e) => setMustInclude(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-ink px-4 py-3 text-lg text-sand focus:outline-none focus:ring-2 focus:ring-acid"
                />
                <span className="text-[11px] text-sand/50">If before the start date, it is ignored.</span>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.3em] text-sand/50">Country</span>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-ink px-4 py-3 text-lg text-sand focus:outline-none focus:ring-2 focus:ring-acid"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.3em] text-sand/50">State / Region</span>
                <select
                  value={subdivision}
                  onChange={(e) => setSubdivision(e.target.value)}
                  disabled={countryInfo.subdivisions.length === 0}
                  className="w-full rounded-2xl border border-white/10 bg-ink px-4 py-3 text-lg text-sand focus:outline-none focus:ring-2 focus:ring-acid disabled:opacity-40"
                >
                  {countryInfo.subdivisions.length === 0 && <option>National</option>}
                  {countryInfo.subdivisions.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-[0.35em] text-sand/50">Custom Work Week</div>
              <div className="mt-4 flex flex-wrap gap-3">
                {WEEKDAYS.map((day) => {
                  const checked = weekendDays.includes(day.value)
                  return (
                    <label key={day.value} className="flex items-center gap-2 text-sm text-sand/70">
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
                        className="h-4 w-4 rounded border-white/20 text-acid focus:ring-acid"
                      />
                      {day.label}
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-[0.35em] text-sand/50">Family Members</div>
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
                      className="flex-1 min-w-[160px] rounded-2xl border border-white/10 bg-ink px-3 py-2 text-sm text-sand focus:outline-none focus:ring-2 focus:ring-acid"
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
                      className="w-28 rounded-2xl border border-white/10 bg-ink px-3 py-2 text-sm text-sand focus:outline-none focus:ring-2 focus:ring-acid"
                      placeholder="Leave"
                    />
                    {members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setMembers((prev) => prev.filter((m) => m.id !== member.id))}
                        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.3em] text-sand/60"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-sand/50">
                <span>Family leave budget: {familyLeaveBudget} days (minimum across members).</span>
                <button
                  type="button"
                  onClick={() =>
                    setMembers((prev) => [
                      ...prev,
                      { id: Date.now(), name: `Member ${prev.length + 1}`, leaveDays: 10 },
                    ])
                  }
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-sand/70"
                >
                  Add member
                </button>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-[0.35em] text-sand/50">Planned Leave Spend</div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  type="number"
                  min="0"
                  value={plannedLeaveSpend ?? ''}
                  onChange={(e) => setPlannedLeaveSpend(Number(e.target.value))}
                  className="w-36 rounded-2xl border border-white/10 bg-ink px-3 py-2 text-sm text-sand focus:outline-none focus:ring-2 focus:ring-acid"
                />
                <span className="text-xs text-sand/60">
                  Available: {familyLeaveBudget} days
                </span>
                {plannedLeaveSpend > familyLeaveBudget && (
                  <span className="text-xs text-blood">Over budget</span>
                )}
              </div>
              <div className="mt-2 text-[11px] text-sand/50">
                Use this to model spending fewer or more days than your current balance.
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-[0.35em] text-sand/50">Blackout Dates</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {blackoutDates.length === 0 && (
                  <span className="text-xs text-sand/50">No blackout dates.</span>
                )}
                {blackoutDates.map((date) => (
                  <button
                    type="button"
                    key={date}
                    onClick={() => setBlackoutDates((prev) => prev.filter((d) => d !== date))}
                    className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-sand/70"
                  >
                    {date} ✕
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="date"
                  value={blackoutInput}
                  onChange={(e) => setBlackoutInput(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-ink px-4 py-2 text-sm text-sand focus:outline-none focus:ring-2 focus:ring-acid"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!blackoutInput) return
                    setBlackoutDates((prev) => [...new Set([...prev, blackoutInput])])
                    setBlackoutInput('')
                  }}
                  className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-sand/70"
                >
                  Add
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={!canProceed || isLoading}
              onClick={() => handleCompute(selectedIndex)}
              className="mt-6 w-full rounded-full bg-acid px-6 py-4 text-sm font-semibold uppercase tracking-[0.3em] text-ink shadow-loud disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-sand/40"
            >
              {isLoading ? 'Calculating...' : 'Find Best Window'}
            </button>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-loud">
              <h3 className="font-display text-xl text-sand">Optimal Window</h3>
              {result ? (
                <div className="mt-4 space-y-3 text-sm text-sand/80">
                  <div className="text-2xl font-semibold text-acid">{result.length} total days off</div>
                  <div>
                    Leave used (per person): <span className="font-semibold text-sand">{result.leaveUsed}</span> /{' '}
                    {plannedLeaveSpend ?? familyLeaveBudget}
                  </div>
                  {result.length > 0 ? (
                    <div>
                      Window: <span className="font-semibold text-sand">{result.windowDates[0]}</span> →{' '}
                      <span className="font-semibold text-sand">{result.windowDates.at(-1)}</span>
                    </div>
                  ) : (
                    <div>No valid window found from the selected start date.</div>
                  )}
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-xs">
                    Leave dates: {result.leaveDates.length ? result.leaveDates.join(', ') : 'No leave days required'}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-sand/60">
                    <span>Weekends: {counts.weekends}</span>
                    <span>Holidays: {counts.holidays}</span>
                    <span>Leave: {counts.leave}</span>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-sand/60">Enter your inputs to see the optimal break.</p>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-loud">
              <h3 className="font-display text-xl text-sand">Leave Tradeoff Curve</h3>
              <p className="mt-2 text-sm text-sand/60">
                Total days off vs leave used (0 → {curveSummary.maxLeave}). Click a suggestion to apply it.
              </p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-ink/60 p-4">
                {curvePoints.length ? (
                  <CurveChart points={curvePoints} suggestions={curveSuggestions} />
                ) : (
                  <div className="text-sm text-sand/60">Run the planner to see the curve.</div>
                )}
              </div>
              {curveSuggestions.length ? (
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-sand/60">
                  <span className="uppercase tracking-[0.3em] text-sand/40">Suggestions</span>
                  {curveSuggestions.map((s) => (
                    <button
                      type="button"
                      key={s.leave}
                      onClick={() => {
                        setPlannedLeaveSpend(s.leave)
                        handleCompute(0, s.leave)
                      }}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1"
                    >
                      {s.leave} leave → {s.daysOff} off
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-loud">
              <h3 className="font-display text-xl text-sand">Top Options</h3>
              {topWindows.length ? (
                <div className="mt-4 space-y-3 text-sm text-sand/70">
                  {topWindows.map((win, idx) => (
                    <button
                      type="button"
                      key={`${win.start}-${win.end}`}
                      onClick={() => {
                        setSelectedIndex(idx)
                        setResult(win)
                      }}
                      className={`w-full rounded-2xl border px-4 py-3 text-left ${
                        idx === selectedIndex
                          ? 'border-acid/60 bg-acid/10 text-sand'
                          : 'border-white/10 bg-white/5 text-sand/70'
                      }`}
                    >
                      <div className="text-sm font-semibold">
                        Option {idx + 1}: {win.length} days off
                      </div>
                      <div className="text-xs text-sand/60">
                        {win.windowDates[0]} → {win.windowDates.at(-1)}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-sand/60">No options computed yet.</p>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-loud">
              <h3 className="font-display text-xl text-sand">Holiday Data Status</h3>
              <ul className="mt-4 space-y-2 text-sm text-sand/70">
                <li>Country: {countryInfo.name}</li>
                <li>State: {countryInfo.subdivisions.length ? subdivision : 'National'}</li>
                <li>File: /public/data/holidays-{country}-{year}.csv</li>
                <li>Loaded: {holidays.length} rows</li>
                <li>Family members: {members.length}</li>
              </ul>
              <button
                type="button"
                onClick={handleCopyLink}
                className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs uppercase tracking-[0.3em] text-sand/70"
              >
                {copied ? 'Link copied' : 'Copy shareable plan link'}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/30 p-6 shadow-loud">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-sand">Calendar View</h2>
            <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.3em] text-sand/60">
              <span className="rounded-full border border-sky/50 bg-sky/10 px-3 py-1 text-sky">Holiday</span>
              <span className="rounded-full border border-acid/60 bg-acid/20 px-3 py-1 text-ink">Leave</span>
              <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1">Weekend</span>
              <span className="rounded-full border border-blood/50 bg-blood/10 px-3 py-1 text-blood">
                Blackout
              </span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.3em] text-sand/50">
            <span>Filter</span>
            {['all', 'window', 'off'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCalendarFilter(mode)}
                className={`rounded-full border px-3 py-1 ${
                  calendarFilter === mode
                    ? 'border-acid/60 bg-acid/10 text-sand'
                    : 'border-white/10 bg-white/5 text-sand/60'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="mt-8">
            <Calendar year={year} dayMeta={dayMeta} filterMode={calendarFilter} />
          </div>
        </section>
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
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full text-sand">
      <rect x="0" y="0" width={width} height={height} rx="16" fill="rgba(255,255,255,0.02)" />
      <path d={stepPath} fill="none" stroke="#d7ff3f" strokeWidth="3" />
      {points.map((p) => (
        <circle
          key={p.leave}
          cx={scaleX(p.leave)}
          cy={scaleY(p.daysOff)}
          r="3.5"
          fill="#66d1ff"
        />
      ))}
      {suggestions.map((p) => (
        <g key={`s-${p.leave}`}>
          <circle
            cx={scaleX(p.leave)}
            cy={scaleY(p.daysOff)}
            r="6"
            fill="rgba(255,63,110,0.35)"
          />
          <text
            x={scaleX(p.leave)}
            y={scaleY(p.daysOff) - 10}
            textAnchor="middle"
            fontSize="10"
            fill="rgba(255,255,255,0.7)"
          >
            {p.leave}/{p.daysOff}
          </text>
        </g>
      ))}
      {ticks.map((t) => (
        <text key={t} x={scaleX(t)} y={height - 6} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)">
          {t}
        </text>
      ))}
      <text x={padding} y={14} fontSize="10" fill="rgba(255,255,255,0.5)">
        Days off
      </text>
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
