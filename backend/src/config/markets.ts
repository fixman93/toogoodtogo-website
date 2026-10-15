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
}

export const MARKETS: Record<string, Market> = {
  RS: {
    code: 'RS',
    name: 'Srbija',
    locale: 'sr-Latn-RS',
    currency: 'RSD',
    timezone: 'Europe/Belgrade',
    cancellationCutoffMinutes: 30,
    maxQuantityPerReservation: 4,
    expiryGraceMinutes: 60,
  },
}

export function getMarket(code: string): Market {
  const market = MARKETS[code]
  if (!market) throw new Error(`Unknown market "${code}"`)
  return market
}
