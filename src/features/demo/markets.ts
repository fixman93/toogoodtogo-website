/**
 * Countries the /demo walkthrough can be shown for. Each one has its own
 * example city, bakery and prices in the local currency; locale and currency
 * come from the app's market config, so money is formatted the same way.
 */
import { MARKETS, PLATFORM_COMMISSION_RATE, currencyInfo, type MarketConfig } from '@/config/markets'

export interface DemoMarket {
  code: string
  name: string
  currency: string
  /** What prices are shown in, e.g. "RSD", "KM", "€". */
  currencyLabel: string
  city: string
  /** Neighbourhood of the demo bakery ("Pekara Dorćol"). */
  area: string
  street: string
  /** Second bakery in the list. */
  otherArea: string
  /** Prices in minor units. */
  bagPrice: number
  bagValue: number
  sweetPrice: number
  sweetValue: number
  /** "Na vrhu liste" boost (same as backend boostPrices.top). */
  boostTop: number
  /** Formats minor units, e.g. 29900 → "299 RSD", 590 → "5,90 KM". */
  money: (minor: number) => string
  /** Same, without decimals (stat tiles). */
  moneyWhole: (minor: number) => string
}

type Place = Pick<DemoMarket, 'city' | 'area' | 'street' | 'otherArea' | 'bagPrice' | 'bagValue' | 'sweetPrice' | 'sweetValue' | 'boostTop'>

const PLACES: Record<string, Place> = {
  RS: { city: 'Beograd', area: 'Dorćol', street: 'Cara Dušana 45', otherArea: 'Vračar', bagPrice: 29900, bagValue: 90000, sweetPrice: 34900, sweetValue: 105000, boostTop: 20000 },
  BA: { city: 'Sarajevo', area: 'Baščaršija', street: 'Ferhadija 12', otherArea: 'Marijin Dvor', bagPrice: 590, bagValue: 1800, sweetPrice: 690, sweetValue: 2100, boostTop: 300 },
  HR: { city: 'Zagreb', area: 'Donji grad', street: 'Ilica 45', otherArea: 'Trešnjevka', bagPrice: 350, bagValue: 1050, sweetPrice: 390, sweetValue: 1170, boostTop: 150 },
}

function build(config: MarketConfig, place: Place): DemoMarket {
  const info = currencyInfo(config.currency)
  const format = (decimals: number) =>
    new Intl.NumberFormat(config.locale, { style: 'currency', currency: config.currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const full = format(info.displayDecimals)
  const whole = format(0)
  const label = full.formatToParts(1).find((part) => part.type === 'currency')?.value ?? config.currency
  return {
    code: config.code,
    name: config.name,
    currency: config.currency,
    currencyLabel: label,
    ...place,
    money: (minor) => full.format(minor / info.minorUnits),
    moneyWhole: (minor) => whole.format(minor / info.minorUnits),
  }
}

export const DEMO_MARKETS: DemoMarket[] = Object.entries(PLACES).map(([code, place]) => build(MARKETS[code], place))

/** Country from the URL (`?zemlja=ba`), case-insensitive; null if missing or unknown. */
export function demoMarketFor(code: string | null): DemoMarket | null {
  if (!code) return null
  return DEMO_MARKETS.find((m) => m.code === code.toUpperCase()) ?? null
}

/** Platform commission shown in the demo. */
export const DEMO_COMMISSION_RATE = PLATFORM_COMMISSION_RATE

/** Example month for one location: 124 bags, 3 bags of platform-funded discounts, 2 boosts. */
export function demoStatement(m: DemoMarket) {
  const bags = 124
  const gross = bags * m.bagPrice
  const commission = Math.round(gross * DEMO_COMMISSION_RATE)
  const discounts = 3 * m.bagPrice
  const boosts = 2 * m.boostTop
  return { bags, gross, commission, discounts, boosts, total: commission - discounts + boosts }
}
