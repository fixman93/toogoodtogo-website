import type { ReservationStatus } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { t } from '@/i18n'

const VARIANTS = {
  pending_payment: 'accent',
  confirmed: 'default',
  collected: 'success',
  cancelled: 'destructive',
  expired: 'muted',
} as const

export function StatusBadge({ status }: { status: ReservationStatus }) {
  return <Badge variant={VARIANTS[status]}>{t(`status.${status}`)}</Badge>
}
