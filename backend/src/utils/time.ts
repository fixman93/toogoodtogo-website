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
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - date.getTime()
}

/**
 * UTC instant for a wall-clock time ("HH:mm") `dayOffset` days from today in
 * `timeZone`. All dates are stored in UTC; timezones only matter at the edges.
 */
export function zonedTime(dayOffset: number, hhmm: string, timeZone: string, now = new Date()): Date {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now)
    .split('-')
    .map(Number)
  const [h, m] = hhmm.split(':').map(Number)
  const guess = new Date(Date.UTC(year, month - 1, day + dayOffset, h, m))
  return new Date(guess.getTime() - tzOffset(guess, timeZone))
}
