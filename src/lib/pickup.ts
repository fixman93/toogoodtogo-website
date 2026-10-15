/**
 * QR payload for a reservation. Contains the reservation id (exact lookup)
 * and the short code (what staff can also type). Neither is secret on its own:
 * collecting requires a signed-in business account that owns the location.
 */
const PREFIX = 'ZALOGAJ:R:'

export function pickupQrValue(reservationId: string, code: string) {
  return `${PREFIX}${reservationId}:${code}`
}

export function parsePickupQr(text: string): { reservationId: string; code: string } | null {
  if (!text.startsWith(PREFIX)) return null
  const [reservationId, code] = text.slice(PREFIX.length).split(':')
  return reservationId && code ? { reservationId, code } : null
}
