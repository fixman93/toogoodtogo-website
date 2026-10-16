/**
 * QR payload for a reservation. Contains the reservation id (exact lookup)
 * and the short code (what staff can also type). Neither is secret on its own:
 * collecting requires a signed-in business account that owns the location.
 */
const PREFIX = 'FOODNESI:R:'
/** QR codes issued before the rename to Foodnesi (e-mails, screenshots) still scan. */
const PREFIXES = [PREFIX, 'ZALOGAJ:R:']

export function pickupQrValue(reservationId: string, code: string) {
  return `${PREFIX}${reservationId}:${code}`
}

export function parsePickupQr(text: string): { reservationId: string; code: string } | null {
  const prefix = PREFIXES.find((p) => text.startsWith(p))
  if (!prefix) return null
  const [reservationId, code] = text.slice(prefix.length).split(':')
  return reservationId && code ? { reservationId, code } : null
}
