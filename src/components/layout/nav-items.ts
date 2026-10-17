import { CalendarCheck, Compass, Heart, ScanLine, Search, UserRound, type LucideIcon } from 'lucide-react'
import type { MessageKey } from '@/i18n'

export const NAV_ITEMS: { to: string; label: MessageKey; Icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'nav.discover', Icon: Compass, end: true },
  { to: '/browse', label: 'nav.browse', Icon: Search },
  { to: '/reservations', label: 'nav.reservations', Icon: CalendarCheck },
  { to: '/favorites', label: 'nav.favorites', Icon: Heart },
  { to: '/profile', label: 'nav.profile', Icon: UserRound },
]

/** Partners and staff: "Skeniraj" takes the place of "Omiljeno" — one tap to the scanner. */
export const PARTNER_NAV_ITEMS: typeof NAV_ITEMS = NAV_ITEMS.map((item) =>
  item.to === '/favorites' ? { to: '/business/scan', label: 'nav.scan', Icon: ScanLine } : item,
)
