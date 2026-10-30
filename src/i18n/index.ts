import { market } from '@/config/markets'
import { en } from './en'
import { toCyrillic } from './script'
import { srLatn, type MessageKey, type Messages, type PluralMessage } from './sr-Latn'

const catalogues: Record<string, Messages> = { 'sr-Latn': srLatn, en }

export type Script = 'latn' | 'cyrl'
const SCRIPT_KEY = 'foodnesi.script'

/** Latin (default) or Cyrillic; chosen in Profile → Settings, stored per device. */
export const script: Script = (() => {
  try {
    return localStorage.getItem(SCRIPT_KEY) === 'cyrl' ? 'cyrl' : 'latn'
  } catch {
    return 'latn'
  }
})()

export type Language = 'sr-Latn' | 'en'
const LANGUAGE_KEY = 'foodnesi.language'

/** App language, independent of country/market; chosen in Profile → Settings, stored per device. */
export const language: Language = (() => {
  try {
    return localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : market.language
  } catch {
    return market.language
  }
})()

/** Switching language re-renders everything, so the simplest correct thing is a reload. */
export function setLanguage(next: Language) {
  try {
    localStorage.setItem(LANGUAGE_KEY, next)
  } catch {
    /* ignore */
  }
  window.location.reload()
}

/** Locale for Intl formatting (dates, numbers): English when the language is English, else the active script. */
export const activeLocale = language === 'en' ? 'en-US' : script === 'cyrl' ? market.locale.replace('Latn', 'Cyrl') : market.locale

/** Switching script re-renders everything, so the simplest correct thing is a reload. */
export function setScript(next: Script) {
  try {
    localStorage.setItem(SCRIPT_KEY, next)
  } catch {
    /* ignore */
  }
  window.location.reload()
}

/** Show free text (e.g. API error messages) in the active script. */
export function localize(text: string) {
  return language === 'sr-Latn' && script === 'cyrl' ? toCyrillic(text) : text
}

if (typeof document !== 'undefined') document.documentElement.lang = language === 'en' ? 'en' : script === 'cyrl' ? 'sr-Cyrl' : 'sr-Latn'

const messages = catalogues[language] ?? srLatn
const pluralRules = new Intl.PluralRules(activeLocale)

type Params = Record<string, string | number>

/**
 * Translate a message key. Pass `count` to select a plural form.
 * Kept dependency-free; swap for i18next/FormatJS if needs grow.
 */
export function t(key: MessageKey, params: Params = {}): string {
  const entry = messages[key] ?? key
  let text: string
  if (typeof entry === 'string') {
    text = entry
  } else {
    const count = Number(params.count ?? 0)
    const form = pluralRules.select(count) as keyof PluralMessage
    text = entry[form] ?? entry.other
  }
  // Transliterate the template first so interpolated user content (names, titles) stays as entered.
  return localize(text).replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}

export type { MessageKey }
