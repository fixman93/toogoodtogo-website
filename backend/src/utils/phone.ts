/**
 * Phone numbers are stored in international E.164 form (+381641234567), so
 * "064 123 4567", "+381 64 123-4567" and "0038164..." are the same number —
 * required for "one phone number per account".
 */
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min'
import { ApiError } from './ApiError.js'

/** Local numbers ("064…") are read in the user's country; "+…"/"00…" numbers work from anywhere. */
export function normalizePhone(input: string, countryCode: string): string {
  const cleaned = input.trim().replace(/^00/, '+')
  const parsed = parsePhoneNumberFromString(cleaned, countryCode.toUpperCase() as CountryCode)
  if (!parsed?.isValid()) throw ApiError.badRequest('Broj telefona nije ispravan. Npr. 064 123 4567 ili +381 64 123 4567.', 'PHONE_INVALID')
  return parsed.number
}

export const phoneTaken = () => ApiError.conflict('Ovaj broj telefona je već povezan sa drugim nalogom.', 'PHONE_TAKEN')

/** Mongo duplicate-key error on the phone index (two sign-ups racing with the same number). */
export const isPhoneDuplicate = (error: unknown) =>
  typeof error === 'object' && !!error && (error as { code?: number }).code === 11000 && 'phone' in ((error as { keyPattern?: object }).keyPattern ?? {})
