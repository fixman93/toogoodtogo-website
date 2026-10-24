/**
 * Estimate for the partner pitch: how much food a business throws away each
 * month, and how much of it would come back by selling it as surprise bags.
 * Every assumption is listed here and shown under the calculator.
 */
import { PLATFORM_COMMISSION_RATE } from '@/config/markets'

export const LOSS_ASSUMPTIONS = {
  /** A bag sells for about a third of what's inside ("po trećini cene"). */
  priceShare: 1 / 3,
  /** Share of bags that actually sell. */
  sellThrough: 0.8,
  weeksPerMonth: 52 / 12,
  /** Same estimates as the customer's impact page. */
  kgPerBag: 1,
  co2KgPerBag: 2.7,
  commissionRate: PLATFORM_COMMISSION_RATE,
}

export type BusinessKind = 'bakery' | 'meals' | 'groceries' | 'sweets'

/** Typical end-of-day leftovers, relative to a bakery. */
const KIND_FACTOR: Record<BusinessKind, number> = { bakery: 1, meals: 1.5, groceries: 3, sweets: 0.7 }

interface CurrencyRange {
  min: number
  max: number
  step: number
  /** Daily leftovers of a typical bakery. */
  bakery: number
  /** Value of what goes into one bag. */
  bagValue: number
}

/** Slider ranges in major units of each currency. */
const RANGES: Record<string, CurrencyRange> = {
  RSD: { min: 500, max: 30000, step: 500, bakery: 3000, bagValue: 900 },
  BAM: { min: 10, max: 500, step: 5, bakery: 50, bagValue: 18 },
  EUR: { min: 5, max: 250, step: 5, bakery: 25, bagValue: 10 },
  MKD: { min: 250, max: 15000, step: 250, bakery: 1500, bagValue: 450 },
}

export const rangeFor = (currency: string): CurrencyRange => RANGES[currency] ?? RANGES.EUR

/** Starting value for a kind of business, rounded to the slider step. */
export function defaultDailyValue(currency: string, kind: BusinessKind) {
  const r = rangeFor(currency)
  return Math.min(r.max, Math.round((r.bakery * KIND_FACTOR[kind]) / r.step) * r.step)
}

export function estimateLoss(currency: string, dailyValue: number, daysPerWeek: number) {
  const a = LOSS_ASSUMPTIONS
  const monthlyLoss = dailyValue * daysPerWeek * a.weeksPerMonth
  const bagsPerDay = Math.max(1, Math.round(dailyValue / rangeFor(currency).bagValue))
  const monthlyBags = Math.round(bagsPerDay * daysPerWeek * a.weeksPerMonth * a.sellThrough)
  const monthlyNet = monthlyLoss * a.priceShare * a.sellThrough * (1 - a.commissionRate)
  return {
    monthlyLoss,
    yearlyLoss: monthlyLoss * 12,
    monthlyNet,
    yearlyNet: monthlyNet * 12,
    bagsPerDay,
    monthlyBags,
    kgFood: monthlyBags * a.kgPerBag,
    co2Kg: Math.round(monthlyBags * a.co2KgPerBag),
  }
}

/** Whole amounts in the market currency ("78.000 RSD", "1.300 €"). */
export function formatWhole(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(Math.round(amount))
}
