import { Link } from 'react-router'
import { ChevronRight, Clock } from 'lucide-react'
import type { Reservation } from '@/api/types'
import { SafeImage } from '@/components/common/SafeImage'
import { formatMoney, formatPickupWindow } from '@/lib/format'
import { StatusBadge } from './StatusBadge'

export function ReservationRow({ reservation: r }: { reservation: Reservation }) {
  return (
    <Link
      to={`/reservations/${r.id}`}
      className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-3 shadow-card transition-colors hover:bg-muted/50"
    >
      <SafeImage src={r.offer.imageUrl} alt="" className="size-20 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-bold">{r.business.name}</p>
          <StatusBadge status={r.status} />
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {r.quantity} × {r.offer.title}
        </p>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="size-3.5" />
            {formatPickupWindow(r.pickupStart, r.pickupEnd, r.timezone)}
          </span>
          <span className="font-bold">{formatMoney(r.totalMinor, r.currency)}</span>
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  )
}
