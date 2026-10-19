import type { Reservation } from '@/api/types'

/** "Kupac je stigao" is shown while the arrival is this recent. */
const ARRIVED_FRESH_MS = 20 * 60_000

export const arrivedRecently = (r: Reservation) => !!r.presence && Date.now() - new Date(r.presence.lastAt).getTime() < ARRIVED_FRESH_MS
