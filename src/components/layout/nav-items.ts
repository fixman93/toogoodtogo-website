import { CalendarCheck, ClipboardList, Compass, Heart, Plus, ScanLine, Search, Store, UserRound, type LucideIcon } from 'lucide-react'
import type { MessageKey } from '@/i18n'

/** `highlight`: the main action, drawn as a filled circle in the mobile bar. */
export type NavItem = { to: string; label: MessageKey; Icon: LucideIcon; end?: boolean; highlight?: boolean }

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'nav.discover', Icon: Compass, end: true },
  { to: '/browse', label: 'nav.browse', Icon: Search },
  { to: '/reservations', label: 'nav.reservations', Icon: CalendarCheck },
  { to: '/favorites', label: 'nav.favorites', Icon: Heart },
  { to: '/profile', label: 'nav.profile', Icon: UserRound },
]

/** Staff: "Skeniraj" takes the place of "Omiljeno" — one tap to the scanner. */
export const PARTNER_NAV_ITEMS: NavItem[] = NAV_ITEMS.map((item) =>
  item.to === '/favorites' ? { to: '/business/scan', label: 'nav.scan', Icon: ScanLine } : item,
)

/** Partner (owner): the app is a work tool — portal, orders, new offer (centre), scanner, profile. */
export const OWNER_NAV_ITEMS: NavItem[] = [
  { to: '/business', label: 'nav.portal', Icon: Store, end: true },
  { to: '/business/orders', label: 'orders.title', Icon: ClipboardList },
  { to: '/business/new', label: 'nav.newOffer', Icon: Plus, highlight: true },
  { to: '/business/scan', label: 'nav.scan', Icon: ScanLine },
  { to: '/profile', label: 'nav.profile', Icon: UserRound },
]
