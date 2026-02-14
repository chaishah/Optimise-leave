import { dayLabel, getMonthMatrix, monthLabel, toISODateUTC } from '../lib/dateUtils.js'

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const DayCell = ({ date, meta, filterMode }) => {
  if (!date) return <div className="h-12 rounded-lg bg-black/20" />

  const iso = toISODateUTC(date)
  const info = meta[iso] || {}

  const base = 'h-12 rounded-lg border border-white/10 flex flex-col items-center justify-center text-xs'
  const classes = [base]
  if (filterMode === 'window' && !info.isWindow) classes.push('opacity-30')
  if (filterMode === 'off' && !info.isWeekend && !info.isHoliday && !info.isLeave && !info.isBlocked) {
    return <div className="h-12 rounded-lg bg-black/20" />
  }
  if (info.isWeekend) classes.push('bg-white/5 text-sand/70')
  if (info.isHoliday) classes.push('bg-sky/20 border-sky/50 text-sky')
  if (info.isLeave) classes.push('bg-acid/30 border-acid text-ink font-semibold')
  if (info.isBlocked) classes.push('bg-blood/20 border-blood/60 text-blood')
  if (info.isWindow) classes.push('shadow-ring')

  const tooltip = [
    info.label || null,
    info.isLeave ? 'Leave' : null,
    info.isHoliday ? 'Holiday' : null,
    info.isWeekend ? 'Weekend' : null,
    info.isBlocked ? 'Blackout' : null,
  ]
    .filter(Boolean)
    .join(' • ')

  return (
    <div className={classes.join(' ')} title={tooltip}>
      <span className="text-sm">{date.getUTCDate()}</span>
      {info.label && (
        <span className="hidden md:block text-[10px] text-sand/70 truncate max-w-[56px]">
          {info.label}
        </span>
      )}
    </div>
  )
}

const Calendar = ({ year, dayMeta, filterMode = 'all', idPrefix = 'main' }) => {
  const handleJump = (e) => {
    const target = document.getElementById(`${idPrefix}-month-${e.target.value}`)
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <div className="text-xs uppercase tracking-[0.3em] text-sand/50">Jump to month</div>
        <select
          className="rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-sand focus:outline-none focus:ring-2 focus:ring-acid"
          onChange={handleJump}
          defaultValue="0"
        >
          {Array.from({ length: 12 }).map((_, idx) => (
            <option key={idx} value={idx}>
              {monthLabel(year, idx)}
            </option>
          ))}
        </select>
      </div>
      {Array.from({ length: 12 }).map((_, idx) => (
        <section key={idx} id={`${idPrefix}-month-${idx}`} className="space-y-3 scroll-mt-24">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl text-sand">{monthLabel(year, idx)}</h3>
            <div className="text-xs uppercase tracking-widest text-sand/50">{year}</div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {WEEK_DAYS.map((day) => (
              <div key={day} className="text-[10px] uppercase tracking-widest text-sand/60">
                {day}
              </div>
            ))}
            {getMonthMatrix(year, idx).map((date, cellIdx) => (
              <DayCell key={`${idx}-${cellIdx}`} date={date} meta={dayMeta} filterMode={filterMode} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export default Calendar
