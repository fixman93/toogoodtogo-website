import { env } from './env.js'

/**
 * Country-specific business rules. Nothing else in the codebase should
 * hardcode a currency, timezone or locale — read it from the market.
 */
export interface Market {
  code: string
  name: string
  locale: string
  currency: string
  timezone: string
  /** Customers may cancel until this many minutes before pickup starts. */
  cancellationCutoffMinutes: number
  /** Max bags a single reservation may contain (offers can set lower). */
  maxQuantityPerReservation: number
  /** Unclaimed reservations become "expired" this long after pickup ends. */
  expiryGraceMinutes: number
  /** Platform commission on collected sales (0.2 = 20%); can be overridden per location. */
  commissionRate: number
  /**
   * Paid promotion of an offer (minor units, market currency), added to the
   * partner's monthly statement: `top` = first in lists until pickup ends,
   * `push` = a push to the location's followers and recent customers.
   */
  boostPrices: { top: number; push: number }
  /** Discount on an invited friend's first bag (percent), paid by the platform. */
  referralDiscountPercent: number
}

const defaults = { cancellationCutoffMinutes: 30, maxQuantityPerReservation: 4, expiryGraceMinutes: 60, commissionRate: 0.2, referralDiscountPercent: 30 }
const boost = { RSD: { top: 20_000, push: 40_000 }, BAM: { top: 300, push: 600 }, EUR: { top: 150, push: 300 }, MKD: { top: 10_000, push: 20_000 } }

/**
 * Supported countries. A location's currency and timezone come from its
 * country, so prices, statements and payments are always in the location's
 * own currency (RSD in Serbia, BAM in Bosnia, EUR in Montenegro, …).
 */
export const MARKETS: Record<string, Market> = {
  RS: { code: 'RS', name: 'Srbija', locale: 'sr-Latn-RS', currency: 'RSD', timezone: 'Europe/Belgrade', ...defaults, boostPrices: boost.RSD },
  BA: { code: 'BA', name: 'Bosna i Hercegovina', locale: 'sr-Latn-BA', currency: 'BAM', timezone: 'Europe/Sarajevo', ...defaults, boostPrices: boost.BAM },
  ME: { code: 'ME', name: 'Crna Gora', locale: 'sr-Latn-ME', currency: 'EUR', timezone: 'Europe/Podgorica', ...defaults, boostPrices: boost.EUR },
  HR: { code: 'HR', name: 'Hrvatska', locale: 'sr-Latn-HR', currency: 'EUR', timezone: 'Europe/Zagreb', ...defaults, boostPrices: boost.EUR },
  SI: { code: 'SI', name: 'Slovenija', locale: 'sr-Latn-SI', currency: 'EUR', timezone: 'Europe/Ljubljana', ...defaults, boostPrices: boost.EUR },
  MK: { code: 'MK', name: 'Severna Makedonija', locale: 'sr-Latn-MK', currency: 'MKD', timezone: 'Europe/Skopje', ...defaults, boostPrices: boost.MKD },
}

export const MARKET_CODES = Object.keys(MARKETS) as [string, ...string[]]

export function getMarket(code: string): Market {
  const market = MARKETS[code]
  if (!market) throw new Error(`Unknown market "${code}"`)
  return market
}

/** Market of a country code; unknown codes fall back to the default market. */
export function marketFor(countryCode: string | undefined, fallback = env.DEFAULT_MARKET): Market {
  return (countryCode && MARKETS[countryCode.toUpperCase()]) || MARKETS[fallback] || MARKETS.RS
}
