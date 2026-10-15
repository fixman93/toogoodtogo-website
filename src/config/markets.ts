/**
 * Country/market settings. Everything market-specific (language, currency,
 * timezone, cities) lives here so the rest of the app never hardcodes Serbia.
 * Add a new entry and set VITE_MARKET to launch in another country.
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
  /** Number of minor units per major unit (RSD: 100 para). */
  currencyMinorUnits: number
  /** Fraction digits shown in UI (whole dinars are customary). */
  currencyDisplayDecimals: number
  timezone: string
  defaultCityId: string
  cities: City[]
  /** Rough bounding box of the country — used to tell if the user is outside the market. */
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }
}

export const MARKETS: Record<string, MarketConfig> = {
  RS: {
    code: 'RS',
    name: 'Srbija',
    locale: 'sr-Latn-RS',
    language: 'sr-Latn',
    currency: 'RSD',
    currencyMinorUnits: 100,
    currencyDisplayDecimals: 0,
    timezone: 'Europe/Belgrade',
    defaultCityId: 'beograd',
    cities: [
      { id: 'beograd', name: 'Beograd', locative: 'Beogradu', lat: 44.8125, lng: 20.4612 },
      { id: 'novi-sad', name: 'Novi Sad', locative: 'Novom Sadu', lat: 45.2671, lng: 19.8335 },
      { id: 'nis', name: 'Niš', locative: 'Nišu', lat: 43.3209, lng: 21.8958 },
      { id: 'kragujevac', name: 'Kragujevac', locative: 'Kragujevcu', lat: 44.0128, lng: 20.9114 },
    ],
    bounds: { minLat: 42.2, maxLat: 46.2, minLng: 18.8, maxLng: 23.1 },
  },
}

export const market: MarketConfig = MARKETS[import.meta.env.VITE_MARKET ?? 'RS'] ?? MARKETS.RS
