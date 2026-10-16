import { currencyInfo, market } from '@/config/markets'
import { activeLocale, t } from '@/i18n'

const moneyFormatters = new Map<string, Intl.NumberFormat>()

/**
 * Format an amount stored in minor units as a localized price in its own
 * currency (pass the offer's/location's currency; the visitor's market is only
 * the fallback).
 */
export function formatMoney(amountMinor: number, currency = market.currency): string {
  const info = currencyInfo(currency)
  let formatter = moneyFormatters.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat(activeLocale, {
      style: 'currency',
      currency,
      minimumFractionDigits: info.displayDecimals,
      maximumFractionDigits: info.displayDecimals,
    })
    moneyFormatters.set(currency, formatter)
  }
  return formatter.format(amountMinor / info.minorUnits)
}

/** Major units → minor units in a currency (e.g. "4,50" € → 450). */
export const toMinor = (amount: number, currency: string) => Math.round(amount * currencyInfo(currency).minorUnits)
/** Minor units → major units for form inputs. */
export const fromMinor = (amountMinor: number, currency: string) => amountMinor / currencyInfo(currency).minorUnits

const decimal = new Intl.NumberFormat(activeLocale, { maximumFractionDigits: 1 })

export function formatDistance(meters?: number | null): string | null {
  if (meters == null) return null
  if (meters < 1000) return `${Math.max(50, Math.round(meters / 50) * 50)} m`
  return `${decimal.format(meters / 1000)} km`
}

/** "4,7", or "Novo" for a business without reviews yet. */
export function formatRating(rating: { average: number; count: number }): string {
  return rating.count > 0 ? decimal.format(rating.average) : t('common.new')
}

function dayKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

/** Formats a time in the business/market timezone, never the browser's. */
export function formatTime(iso: string, timeZone = market.timezone): string {
  return new Intl.DateTimeFormat(activeLocale, { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(iso))
}

export function formatDayLabel(iso: string, timeZone = market.timezone): string {
  const date = new Date(iso)
  const today = dayKey(new Date(), timeZone)
  const tomorrow = dayKey(new Date(Date.now() + 86_400_000), timeZone)
  const key = dayKey(date, timeZone)
  if (key === today) return t('common.today')
  if (key === tomorrow) return t('common.tomorrow')
  return new Intl.DateTimeFormat(activeLocale, { weekday: 'short', day: 'numeric', month: 'short', timeZone }).format(date)
}

/** "Danas 19:00–20:00" */
export function formatPickupWindow(startIso: string, endIso: string, timeZone = market.timezone): string {
  return `${formatDayLabel(startIso, timeZone)} ${formatTime(startIso, timeZone)}–${formatTime(endIso, timeZone)}`
}

export function formatDate(iso: string, timeZone = market.timezone): string {
  return new Intl.DateTimeFormat(activeLocale, { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(new Date(iso))
}

export function discountPercent(original: number, price: number): number {
  if (!original) return 0
  return Math.round((1 - price / original) * 100)
}
