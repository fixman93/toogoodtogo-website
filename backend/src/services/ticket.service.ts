/**
 * Reservation confirmation e-mail ("ticket"): the pickup QR code embedded in
 * the message, the short code, where and when to pick up and what to pay, plus
 * a link to the public pickup pass (works without signing in). Staff can scan
 * the QR straight from the customer's mail app.
 */
import QRCode from 'qrcode'
import type { IBusiness, IReservation } from '../models/index.js'
import { pickupQrValue } from '../utils/pickup.js'
import { sendMail } from './mail.service.js'

const LOCALE = 'sr-Latn-RS'
const WHOLE_UNITS = new Set(['RSD', 'MKD'])

const money = (minor: number, currency: string) => {
  const digits = WHOLE_UNITS.has(currency) ? 0 : 2
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(minor / 100)
}

function pickupWindow(start: Date, end: Date, timeZone: string) {
  const day = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(start)
  const time = (d: Date) => new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(d)
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${time(start)}–${time(end)}`
}

type Ticket = Pick<IReservation, 'code' | 'quantity' | 'offerTitle' | 'totalMinor' | 'discountMinor' | 'currency' | 'pickupStart' | 'pickupEnd' | 'timezone' | 'shareToken'> & { id: string }
type Shop = Pick<IBusiness, 'name' | 'address' | 'collectionInstructions'>

/** Never throws (sendMail doesn't, and QR generation failures are logged). */
export async function sendReservationTicket(to: string, reservation: Ticket, business: Shop) {
  try {
    const png = await QRCode.toBuffer(pickupQrValue(reservation.id, reservation.code), {
      type: 'png',
      width: 440,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f3d2e', light: '#ffffff' },
    })
    const address = [business.address.street, business.address.city].filter(Boolean).join(', ')
    const details: [string, string][] = [
      ['Lokal', business.name],
      ['Adresa', address],
      ['Preuzimanje', pickupWindow(reservation.pickupStart, reservation.pickupEnd, reservation.timezone)],
      ['Ponuda', `${reservation.quantity} × ${reservation.offerTitle}`],
      ['Plaćaš u lokalu', money(reservation.totalMinor, reservation.currency)],
    ]
    if (reservation.discountMinor > 0) details.push(['Popust (promo kod)', `−${money(reservation.discountMinor, reservation.currency)}`])
    const body = [
      'Tvoja kesa je rezervisana. Kada dođeš u lokal, pokaži ovaj QR kod na kasi (može direktno iz mejla) ili reci kod ispod.',
      ...(business.collectionInstructions ? [business.collectionInstructions] : []),
    ].join('\n')
    await sendMail(
      to,
      `Rezervisano · ${reservation.code} · ${business.name}`,
      body,
      reservation.shareToken ? `/pickup/${reservation.shareToken}` : `/reservations/${reservation.id}`,
      'Otvori QR kod',
      { image: { png, alt: `QR kod za preuzimanje ${reservation.code}`, caption: reservation.code }, details },
    )
  } catch (error) {
    console.error('Reservation ticket e-mail failed', error)
  }
}
