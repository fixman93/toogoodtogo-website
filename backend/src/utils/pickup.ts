/** QR payload for a reservation — must match the web app's src/lib/pickup.ts (the scanner parses it). */
const PREFIX = 'ZALOGAJ:R:'

export const pickupQrValue = (reservationId: string, code: string) => `${PREFIX}${reservationId}:${code}`
