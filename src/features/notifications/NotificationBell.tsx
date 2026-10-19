import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Bell, BellRing, CalendarCheck, CheckCircle2, DoorOpen, Flame, Gift, LifeBuoy, MessageCircle, Megaphone, ShieldAlert, Store, Truck, UserPlus, XCircle, type LucideIcon } from 'lucide-react'
import type { NotificationType } from '@/api/types'
import { Sheet } from '@/components/common/Sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { useNotifications, useReadAllNotifications, useUnreadCount } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDayLabel, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const ICONS: Record<NotificationType, LucideIcon> = {
  reservation_new: CalendarCheck,
  reservation_confirmed: CalendarCheck,
  staff_added: UserPlus,
  support_new: LifeBuoy,
  support_reply: LifeBuoy,
  reward: Gift,
  reservation_cancelled: XCircle,
  reservation_collected: CheckCircle2,
  delivery_started: Truck,
  delivery_arrived: DoorOpen,
  delivery_message: MessageCircle,
  offer_boost: Megaphone,
  challenge: Flame,
  integrity_alert: ShieldAlert,
  offer_new: Store,
  waitlist_available: BellRing,
  application_new: Store,
  application_approved: CheckCircle2,
  application_rejected: XCircle,
}

/** Header bell: unread badge + sheet with the latest notifications. */
export function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const unread = useUnreadCount()
  const list = useNotifications(open)
  const readAll = useReadAllNotifications()
  if (!user) return null
  const count = unread.data?.unread ?? 0

  return (
    <>
      <button
        type="button"
        aria-label={`${t('notifications.open')}${count ? ` (${count})` : ''}`}
        onClick={() => {
          setOpen(true)
          if (count) readAll.mutate()
        }}
        className="relative flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted"
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute top-1.5 right-1.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('notifications.title')}>
        {list.isLoading ? (
          <Skeleton className="h-40" />
        ) : !list.data?.items.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('notifications.empty')}</p>
        ) : (
          <ul className="-mx-2 divide-y">
            {list.data.items.map((n) => {
              const Icon = ICONS[n.type] ?? Bell
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    disabled={!n.link}
                    onClick={() => {
                      setOpen(false)
                      if (n.link) navigate(n.link)
                    }}
                    className={cn('flex w-full items-start gap-3 rounded-xl px-2 py-3 text-left hover:bg-muted', !n.read && 'bg-secondary/50')}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <Icon className="size-4 text-primary" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{n.title}</span>
                      {n.body && <span className="block text-sm text-muted-foreground">{n.body}</span>}
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {formatDayLabel(n.createdAt)} {formatTime(n.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Sheet>
    </>
  )
}
