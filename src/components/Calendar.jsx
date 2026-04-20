import { dayLabel, getMonthMatrix, monthLabel, toISODateUTC } from '../lib/dateUtils.js'

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const DayCell = ({ date, meta, filterMode }) => {
  if (!date) return <div className="h-11 rounded-lg bg-l2/40" />

  const iso = toISODateUTC(date)
  const info = meta[iso] || {}

  if (filterMode === 'off' && !info.isWeekend && !info.isHoliday && !info.isLeave && !info.isUnpaidLeave && !info.isBlocked) {
    return <div className="h-11 rounded-lg bg-l2/40" />
  }

  let bg = 'bg-transparent border border-l3'
  let text = 'text-sand/60'
  let ring = ''

  if (info.isWeekend) { bg = 'bg-l2 border border-l3'; text = 'text-sand/40' }
  if (info.isHoliday) { bg = 'bg-sky/10 border border-sky/30'; text = 'text-sky' }
  if (info.isLeave)   { bg = 'bg-primary/20 border border-primary/50'; text = 'text-primary font-semibold' }
  if (info.isUnpaidLeave) { bg = 'bg-blood/10 border border-blood/40'; text = 'text-blood font-semibold' }
  if (info.isBlocked) { bg = 'bg-blood/10 border border-blood/30'; text = 'text-blood' }
  if (info.isWindow)  ring = 'ring-1 ring-primary/30 ring-offset-1 ring-offset-ink'

  const opacity = filterMode === 'window' && !info.isWindow ? 'opacity-25' : ''

  const tooltip = [
    info.label || null,
    info.isUnpaidLeave ? 'Unpaid leave' : info.isLeave ? 'Paid leave' : null,
    info.isHoliday ? 'Holiday' : null,
    info.isWeekend ? 'Weekend' : null,
    info.isBlocked ? 'Blackout' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      className={`flex h-11 flex-col items-center justify-center rounded-lg text-xs ${bg} ${text} ${ring} ${opacity} transition-colors`}
      title={tooltip}
    >
      <span className="text-sm leading-none">{date.getUTCDate()}</span>
      {info.label && (
        <span className="mt-0.5 hidden max-w-[52px] truncate text-[9px] opacity-70 md:block">
          {info.label}
        </span>
      )}
    </div>
  )
}

const Calendar = ({ year, dayMeta, filterMode = 'all', idPrefix = 'main', visibleMonths = null }) => {
  const months = visibleMonths?.length
    ? visibleMonths
    : Array.from({ length: 12 }, (_, idx) => ({ year, month: idx }))

  const handleJump = (e) => {
    const target = document.getElementById(`${idPrefix}-month-${e.target.value}`)
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-10">
      {months.length > 1 && (
      <div className="flex items-center justify-between rounded-xl border border-l3 bg-l2 px-4 py-3">
        <div className="text-[10px] font-medium uppercase tracking-[0.28em] text-sand/40">Jump to month</div>
        <select
          className="rounded-lg border border-l3 bg-l1 px-3 py-1.5 text-sm text-sand focus:outline-none focus:ring-2 focus:ring-primary/40"
          onChange={handleJump}
          defaultValue={`${months[0].year}-${months[0].month}`}
        >
          {months.map(({ year: monthYear, month }) => (
            <option key={`${monthYear}-${month}`} value={`${monthYear}-${month}`}>
              {monthLabel(monthYear, month)}
            </option>
          ))}
        </select>
      </div>
      )}

      {months.map(({ year: monthYear, month }) => (
        <section key={`${monthYear}-${month}`} id={`${idPrefix}-month-${monthYear}-${month}`} className="scroll-mt-24 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold uppercase tracking-wide text-sand">
              {monthLabel(monthYear, month)}
            </h3>
            <div className="font-mono text-[10px] text-sand/30">{monthYear}</div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEK_DAYS.map((day) => (
              <div key={day} className="pb-1 text-center text-[9px] font-medium uppercase tracking-widest text-sand/30">
                {day}
              </div>
            ))}
            {getMonthMatrix(monthYear, month).map((date, cellIdx) => (
              <DayCell key={`${monthYear}-${month}-${cellIdx}`} date={date} meta={dayMeta} filterMode={filterMode} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export default Calendar
