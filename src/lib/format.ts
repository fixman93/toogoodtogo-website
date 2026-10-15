import { market } from '@/config/markets'
import { t } from '@/i18n'

const moneyFormatters = new Map<string, Intl.NumberFormat>()

/** Format an amount stored in minor units (e.g. para) as a localized price. */
export function formatMoney(amountMinor: number, currency = market.currency): string {
  let formatter = moneyFormatters.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat(market.locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: market.currencyDisplayDecimals,
      maximumFractionDigits: market.currencyDisplayDecimals,
    })
    moneyFormatters.set(currency, formatter)
  }
  return formatter.format(amountMinor / market.currencyMinorUnits)
}

const decimal = new Intl.NumberFormat(market.locale, { maximumFractionDigits: 1 })

export function formatDistance(meters?: number | null): string | null {
  if (meters == null) return null
  if (meters < 1000) return `${Math.max(50, Math.round(meters / 50) * 50)} m`
  return `${decimal.format(meters / 1000)} km`
}

export function formatRating(value: number): string {
  return decimal.format(value)
}

function dayKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

/** Formats a time in the business/market timezone, never the browser's. */
export function formatTime(iso: string, timeZone = market.timezone): string {
  return new Intl.DateTimeFormat(market.locale, { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(iso))
}

export function formatDayLabel(iso: string, timeZone = market.timezone): string {
  const date = new Date(iso)
  const today = dayKey(new Date(), timeZone)
  const tomorrow = dayKey(new Date(Date.now() + 86_400_000), timeZone)
  const key = dayKey(date, timeZone)
  if (key === today) return t('common.today')
  if (key === tomorrow) return t('common.tomorrow')
  return new Intl.DateTimeFormat(market.locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone }).format(date)
}

/** "Danas 19:00–20:00" */
export function formatPickupWindow(startIso: string, endIso: string, timeZone = market.timezone): string {
  return `${formatDayLabel(startIso, timeZone)} ${formatTime(startIso, timeZone)}–${formatTime(endIso, timeZone)}`
}

export function formatDate(iso: string, timeZone = market.timezone): string {
  return new Intl.DateTimeFormat(market.locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(new Date(iso))
}

export function discountPercent(original: number, price: number): number {
  if (!original) return 0
  return Math.round((1 - price / original) * 100)
}
