/**
 * Country/market settings. Everything market-specific (currency, timezone,
 * cities) lives here so the rest of the app never hardcodes one country.
 *
 * The active market is the visitor's country (Profile → Zemlja, or detected
 * from the browser's timezone). It decides the default city, the cities list
 * and new-location defaults. Prices are always shown in the currency of the
 * location that sells them (`offer.currency`), whatever the active market.
 */
export interface City {
  id: string
  name: string
  /** Locative for headings: "U Beogradu", "U Novom Sadu". */
  locative: string
  lat: number
  lng: number
}

export interface MarketConfig {
  code: string
  name: string
  /** BCP 47 locale used for Intl number/date formatting. */
  locale: string
  /** Key of the message catalogue in src/i18n. */
  language: 'sr-Latn'
  currency: string
  timezone: string
  defaultCityId: string
  cities: City[]
  /** Example mobile number shown as a placeholder. */
  phoneExample: string
}

export interface CurrencyInfo {
  /** Minor units per major unit (all supported currencies: 100). */
  minorUnits: number
  /** Fraction digits shown in the UI (whole dinars/denars are customary). */
  displayDecimals: number
  /** "Max price" filter steps, in major units. */
  priceSteps: number[]
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
  RSD: { minorUnits: 100, displayDecimals: 0, priceSteps: [300, 500, 800] },
  MKD: { minorUnits: 100, displayDecimals: 0, priceSteps: [150, 250, 400] },
  BAM: { minorUnits: 100, displayDecimals: 2, priceSteps: [5, 8, 12] },
  EUR: { minorUnits: 100, displayDecimals: 2, priceSteps: [3, 5, 8] },
}

export const currencyInfo = (code: string): CurrencyInfo => CURRENCIES[code] ?? { minorUnits: 100, displayDecimals: 2, priceSteps: [3, 5, 8] }

const city = (id: string, name: string, locative: string, lat: number, lng: number): City => ({ id, name, locative, lat, lng })

export const MARKETS: Record<string, MarketConfig> = {
  RS: {
    code: 'RS',
    phoneExample: '064 123 4567',
    name: 'Srbija',
    locale: 'sr-Latn-RS',
    language: 'sr-Latn',
    currency: 'RSD',
    timezone: 'Europe/Belgrade',
    defaultCityId: 'beograd',
    cities: [
      city('beograd', 'Beograd', 'Beogradu', 44.8125, 20.4612),
      city('novi-sad', 'Novi Sad', 'Novom Sadu', 45.2671, 19.8335),
      city('nis', 'Niš', 'Nišu', 43.3209, 21.8958),
      city('kragujevac', 'Kragujevac', 'Kragujevcu', 44.0128, 20.9114),
    ],
  },
  BA: {
    code: 'BA',
    phoneExample: '061 234 567',
    name: 'Bosna i Hercegovina',
    locale: 'sr-Latn-BA',
    language: 'sr-Latn',
    currency: 'BAM',
    timezone: 'Europe/Sarajevo',
    defaultCityId: 'sarajevo',
    cities: [
      city('sarajevo', 'Sarajevo', 'Sarajevu', 43.8563, 18.4131),
      city('banja-luka', 'Banja Luka', 'Banjoj Luci', 44.7722, 17.191),
      city('tuzla', 'Tuzla', 'Tuzli', 44.5384, 18.6763),
      city('mostar', 'Mostar', 'Mostaru', 43.3438, 17.8078),
      city('derventa', 'Derventa', 'Derventi', 44.9767, 17.9086),
    ],
  },
  ME: {
    code: 'ME',
    phoneExample: '067 123 456',
    name: 'Crna Gora',
    locale: 'sr-Latn-ME',
    language: 'sr-Latn',
    currency: 'EUR',
    timezone: 'Europe/Podgorica',
    defaultCityId: 'podgorica',
    cities: [
      city('podgorica', 'Podgorica', 'Podgorici', 42.4304, 19.2594),
      city('niksic', 'Nikšić', 'Nikšiću', 42.7731, 18.9445),
      city('budva', 'Budva', 'Budvi', 42.2864, 18.84),
      city('bar', 'Bar', 'Baru', 42.0931, 19.1003),
    ],
  },
  HR: {
    code: 'HR',
    phoneExample: '091 234 5678',
    name: 'Hrvatska',
    locale: 'sr-Latn-HR',
    language: 'sr-Latn',
    currency: 'EUR',
    timezone: 'Europe/Zagreb',
    defaultCityId: 'zagreb',
    cities: [
      city('zagreb', 'Zagreb', 'Zagrebu', 45.815, 15.9819),
      city('split', 'Split', 'Splitu', 43.5081, 16.4402),
      city('rijeka', 'Rijeka', 'Rijeci', 45.3271, 14.4422),
      city('osijek', 'Osijek', 'Osijeku', 45.555, 18.6955),
    ],
  },
  SI: {
    code: 'SI',
    phoneExample: '041 234 567',
    name: 'Slovenija',
    locale: 'sr-Latn-SI',
    language: 'sr-Latn',
    currency: 'EUR',
    timezone: 'Europe/Ljubljana',
    defaultCityId: 'ljubljana',
    cities: [
      city('ljubljana', 'Ljubljana', 'Ljubljani', 46.0569, 14.5058),
      city('maribor', 'Maribor', 'Mariboru', 46.5547, 15.6459),
      city('celje', 'Celje', 'Celju', 46.2397, 15.2677),
      city('koper', 'Koper', 'Kopru', 45.5481, 13.7302),
    ],
  },
  MK: {
    code: 'MK',
    phoneExample: '070 123 456',
    name: 'Severna Makedonija',
    locale: 'sr-Latn-MK',
    language: 'sr-Latn',
    currency: 'MKD',
    timezone: 'Europe/Skopje',
    defaultCityId: 'skopje',
    cities: [
      city('skopje', 'Skopje', 'Skoplju', 41.9981, 21.4254),
      city('bitola', 'Bitola', 'Bitolju', 41.0297, 21.3292),
      city('ohrid', 'Ohrid', 'Ohridu', 41.1231, 20.8016),
      city('kumanovo', 'Kumanovo', 'Kumanovu', 42.1322, 21.7144),
    ],
  },
}

export const MARKET_LIST = Object.values(MARKETS)

const MARKET_KEY = 'foodnesi.market'
const FALLBACK = MARKETS[import.meta.env.VITE_MARKET ?? 'RS'] ?? MARKETS.RS

/** The country the visitor picked in Profile, if any. */
export function storedMarketCode(): string | null {
  try {
    const code = localStorage.getItem(MARKET_KEY)
    return code && MARKETS[code] ? code : null
  } catch {
    return null
  }
}

/** First visit: guess the country from the browser's timezone (Europe/Sarajevo → BA, …). */
function detectMarket(): MarketConfig | undefined {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return MARKET_LIST.find((m) => m.timezone === tz)
  } catch {
    return undefined
  }
}

export const market: MarketConfig = MARKETS[storedMarketCode() ?? ''] ?? detectMarket() ?? FALLBACK

/** Switch country. Everything market-dependent re-initialises, so reload (like switching script). */
export function setMarket(code: string, reload = true) {
  if (!MARKETS[code]) return
  try {
    localStorage.setItem(MARKET_KEY, code)
    // The saved city belongs to the old country.
    localStorage.removeItem('foodnesi.location')
  } catch {
    /* ignore */
  }
  if (reload) window.location.reload()
}
