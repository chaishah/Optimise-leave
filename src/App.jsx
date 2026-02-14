import { useEffect, useMemo, useState } from 'react'
import Calendar from './components/Calendar.jsx'
import { loadHolidays } from './lib/holidayLoader.js'
import { buildDayMap, findOptimalWindow } from './lib/optimizer.js'

const COUNTRIES = [
  {
    code: 'au',
    name: 'Australia',
    subdivisions: ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'],
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
  const [leaveDays, setLeaveDays] = useState(12)
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

  const countryInfo = COUNTRIES.find((c) => c.code === country)

  const dayMeta = useMemo(() => {
    if (!result || holidays.length === 0) return {}
    const days = buildDayMap(year, holidays, weekendDays)
    const meta = {}
    days.forEach((day) => {
      meta[day.iso] = {
        isWeekend: day.weekend,
        isHoliday: Boolean(day.holiday),
        isLeave: result.leaveDates.includes(day.iso),
        isWindow: result.windowDates.includes(day.iso),
        label: day.holiday?.name || '',
      }
    })
    return meta
  }, [year, holidays, result, weekendDays])

  const handleCompute = async () => {
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
    const filtered = days.filter((d) => d.iso >= startDate)
    const includeDate = mustInclude && mustInclude >= startDate ? mustInclude : ''
    const opt = findOptimalWindow(filtered, Number(leaveDays), includeDate)
    setResult(opt)
    setIsLoading(false)
  }

  const canProceed = Number(leaveDays) > 0 && startDate

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const parsedLeave = Number(params.get('leave'))
    const parsedYear = Number(params.get('year'))
    const parsedWeekend = params.get('weekend')
    const parsedStart = params.get('start')
    const parsedInclude = params.get('include')

    if (!Number.isNaN(parsedLeave) && parsedLeave > 0) setLeaveDays(parsedLeave)
    if (!Number.isNaN(parsedYear) && YEARS.includes(parsedYear)) setYear(parsedYear)
    if (parsedStart) setStartDate(parsedStart)
    if (parsedInclude) setMustInclude(parsedInclude)
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
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('leave', String(leaveDays))
    params.set('year', String(year))
    params.set('country', country)
    if (subdivision) params.set('subdivision', subdivision)
    if (startDate) params.set('start', startDate)
    if (mustInclude) params.set('include', mustInclude)
    if (weekendDays.length) params.set('weekend', weekendDays.join(','))
    const newUrl = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState(null, '', newUrl)
  }, [leaveDays, year, country, subdivision, startDate, mustInclude, weekendDays])

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
                <span className="text-xs uppercase tracking-[0.3em] text-sand/50">Leave Days</span>
                <input
                  type="number"
                  min="1"
                  value={leaveDays}
                  onChange={(e) => setLeaveDays(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-ink px-4 py-3 text-lg text-sand focus:outline-none focus:ring-2 focus:ring-acid"
                />
              </label>
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
                    <option key={s} value={s}>
                      {s}
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

            <button
              type="button"
              disabled={!canProceed || isLoading}
              onClick={handleCompute}
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
                    Leave used: <span className="font-semibold text-sand">{result.leaveUsed}</span> /{' '}
                    {leaveDays}
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
              <h3 className="font-display text-xl text-sand">Holiday Data Status</h3>
              <ul className="mt-4 space-y-2 text-sm text-sand/70">
                <li>Country: {countryInfo.name}</li>
                <li>State: {countryInfo.subdivisions.length ? subdivision : 'National'}</li>
                <li>File: /public/data/holidays-{country}-{year}.csv</li>
                <li>Loaded: {holidays.length} rows</li>
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
            </div>
          </div>
          <div className="mt-8">
            <Calendar year={year} dayMeta={dayMeta} />
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
