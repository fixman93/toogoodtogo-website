/**
 * Country/market settings. Everything market-specific (language, currency,
 * timezone, cities) lives here so the rest of the app never hardcodes Serbia.
 * Add a new entry and set VITE_MARKET to launch in another country.
 */
export interface City {
  id: string
  name: string
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
      { id: 'beograd', name: 'Beograd', lat: 44.8125, lng: 20.4612 },
      { id: 'novi-sad', name: 'Novi Sad', lat: 45.2671, lng: 19.8335 },
      { id: 'nis', name: 'Niš', lat: 43.3209, lng: 21.8958 },
      { id: 'kragujevac', name: 'Kragujevac', lat: 44.0128, lng: 20.9114 },
    ],
  },
}

export const market: MarketConfig = MARKETS[import.meta.env.VITE_MARKET ?? 'RS'] ?? MARKETS.RS
