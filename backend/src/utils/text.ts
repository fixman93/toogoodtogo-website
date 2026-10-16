export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** URL slug that handles Serbian Latin diacritics (đ → dj, č → c …). */
export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/đ/g, 'dj')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Prefix of new pickup codes. Codes issued before the rename to Foodnesi start with "ZL-". */
export const PICKUP_PREFIX = 'FN-'
const LEGACY_PREFIXES = ['ZL-']

/** Short, unambiguous pickup code shown to staff, e.g. "FN-4F7K". */
export function pickupCode() {
  return PICKUP_PREFIX + Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
}

/** Every stored form of a 4-character code ("4F7K" → FN-4F7K, ZL-4F7K). */
export const pickupCodeVariants = (core: string) => [PICKUP_PREFIX, ...LEGACY_PREFIXES].map((p) => p + core)
