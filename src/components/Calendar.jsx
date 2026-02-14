import { dayLabel, getMonthMatrix, monthLabel, toISODateUTC } from '../lib/dateUtils.js'

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const DayCell = ({ date, meta }) => {
  if (!date) return <div className="h-12 rounded-lg bg-black/20" />

  const iso = toISODateUTC(date)
  const info = meta[iso] || {}

  const base = 'h-12 rounded-lg border border-white/10 flex flex-col items-center justify-center text-xs'
  const classes = [base]
  if (info.isWeekend) classes.push('bg-white/5 text-sand/70')
  if (info.isHoliday) classes.push('bg-sky/20 border-sky/50 text-sky')
  if (info.isLeave) classes.push('bg-acid/30 border-acid text-ink font-semibold')
  if (info.isWindow) classes.push('shadow-ring')

  return (
    <div className={classes.join(' ')}>
      <span className="text-sm">{date.getUTCDate()}</span>
      {info.label && <span className="text-[10px] text-sand/70">{info.label}</span>}
    </div>
  )
}

const Calendar = ({ year, dayMeta }) => {
  return (
    <div className="space-y-10">
      {Array.from({ length: 12 }).map((_, idx) => (
        <section key={idx} className="space-y-3">
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
              <DayCell key={`${idx}-${cellIdx}`} date={date} meta={dayMeta} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export default Calendar
