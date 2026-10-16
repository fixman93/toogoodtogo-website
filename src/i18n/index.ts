import { market } from '@/config/markets'
import { toCyrillic } from './script'
import { srLatn, type MessageKey, type Messages, type PluralMessage } from './sr-Latn'

const catalogues: Record<string, Messages> = { 'sr-Latn': srLatn }

export type Script = 'latn' | 'cyrl'
const SCRIPT_KEY = 'zalogaj.script'

/** Latin (default) or Cyrillic; chosen in Profile → Settings, stored per device. */
export const script: Script = (() => {
  try {
    return localStorage.getItem(SCRIPT_KEY) === 'cyrl' ? 'cyrl' : 'latn'
  } catch {
    return 'latn'
  }
})()

/** Locale for Intl formatting (dates, numbers) in the active script. */
export const activeLocale = script === 'cyrl' ? market.locale.replace('Latn', 'Cyrl') : market.locale

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
  return script === 'cyrl' ? toCyrillic(text) : text
}

if (typeof document !== 'undefined') document.documentElement.lang = script === 'cyrl' ? 'sr-Cyrl' : 'sr-Latn'

const messages = catalogues[market.language] ?? srLatn
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
