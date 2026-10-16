/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffset(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - date.getTime()
}

/** Local calendar date parts (in `timeZone`) for an instant. */
export function zonedDateParts(date: Date, timeZone: string) {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(date)
    .split('-')
    .map(Number)
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(date))
  return { year, month, day, hour }
}

/** UTC instant for a wall-clock time ("HH:mm") `dayOffset` days from today in `timeZone`. */
export function zonedTime(dayOffset: number, hhmm: string, timeZone: string, now = new Date()): Date {
  const { year, month, day } = zonedDateParts(now, timeZone)
  const [h, m] = hhmm.split(':').map(Number)
  const guess = new Date(Date.UTC(year, month - 1, day + dayOffset, h, m))
  return new Date(guess.getTime() - tzOffset(guess, timeZone))
}

/** UTC instant for a calendar date ("YYYY-MM-DD") and wall-clock time ("HH:mm") in `timeZone`. */
export function zonedDateTimeToUtc(date: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = hhmm.split(':').map(Number)
  const guess = new Date(Date.UTC(y, m - 1, d, h, min))
  return new Date(guess.getTime() - tzOffset(guess, timeZone))
}

/** Form-friendly local parts of an instant: { date: "YYYY-MM-DD", time: "HH:mm" } in `timeZone`. */
export function toZonedInput(iso: string | Date, timeZone: string) {
  const at = typeof iso === 'string' ? new Date(iso) : iso
  const date = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)
  return { date, time }
}

/** "YYYY-MM-DD" `days` after the given local date. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Current "YYYY-MM" in the market timezone. */
export function currentMonth(timeZone = 'Europe/Belgrade') {
  return toZonedInput(new Date(), timeZone).date.slice(0, 7)
}
