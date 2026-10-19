import type { BagSuggestion } from '@/api/types'
import { t, type MessageKey } from '@/i18n'

/** "Pon", "Uto"… (1 = Monday). */
export const weekdayShort = (d: number) => t(`weekday.${d}` as MessageKey)

/** ISO weekday (1 = Monday) of a local date "YYYY-MM-DD". */
export const isoWeekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay() || 7

/** Suggested bags for the chosen weekdays (average of their suggestions); null without history. */
export function suggestedFor(data: BagSuggestion | undefined, weekdays: number[]) {
  const values = (data?.days ?? []).filter((d) => weekdays.includes(d.weekday) && d.suggested != null).map((d) => d.suggested!)
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null
}
