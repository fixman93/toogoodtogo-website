import { CalendarCheck, Compass, Heart, Search, UserRound, type LucideIcon } from 'lucide-react'
import type { MessageKey } from '@/i18n'

export const NAV_ITEMS: { to: string; label: MessageKey; Icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'nav.discover', Icon: Compass, end: true },
  { to: '/browse', label: 'nav.browse', Icon: Search },
  { to: '/reservations', label: 'nav.reservations', Icon: CalendarCheck },
  { to: '/favorites', label: 'nav.favorites', Icon: Heart },
  { to: '/profile', label: 'nav.profile', Icon: UserRound },
]
