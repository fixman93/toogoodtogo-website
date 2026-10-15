import { market } from '@/config/markets'
import { srLatn, type MessageKey, type Messages, type PluralMessage } from './sr-Latn'

const catalogues: Record<string, Messages> = { 'sr-Latn': srLatn }

const messages = catalogues[market.language] ?? srLatn
const pluralRules = new Intl.PluralRules(market.locale)

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
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}

export type { MessageKey }
