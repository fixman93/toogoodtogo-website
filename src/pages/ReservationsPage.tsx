import { useState } from 'react'
import { Link } from 'react-router'
import { History, ShoppingBag } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { RequireAuth } from '@/components/common/RequireAuth'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { ReservationRow } from '@/components/reservations/ReservationRow'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useReservations } from '@/hooks/api'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

type Tab = 'upcoming' | 'history'

function ReservationList({ scope }: { scope: Tab }) {
  const { data, isLoading, isError, refetch } = useReservations(scope)

  if (isLoading)
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-26 rounded-2xl" />
        ))}
      </div>
    )
  if (isError) return <ErrorState onRetry={() => refetch()} />
  if (!data?.data.length)
    return scope === 'upcoming' ? (
      <EmptyState
        icon={ShoppingBag}
        title={t('reservations.emptyUpcomingTitle')}
        text={t('reservations.emptyUpcomingText')}
        action={
          <Button asChild>
            <Link to="/">{t('nav.discover')}</Link>
          </Button>
        }
      />
    ) : (
      <EmptyState icon={History} title={t('reservations.history')} text={t('reservations.emptyHistory')} />
    )

  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {data.data.map((r) => (
        <li key={r.id}>
          <ReservationRow reservation={r} />
        </li>
      ))}
    </ul>
  )
}

export function ReservationsPage() {
  const [tab, setTab] = useState<Tab>('upcoming')
  return (
    <div>
      <PageHeader title={t('reservations.title')} />
      <RequireAuth>
        <div role="tablist" className="mb-5 inline-flex rounded-full bg-muted p-1">
          {(['upcoming', 'history'] as const).map((id) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                'h-10 rounded-full px-5 text-sm font-semibold transition-all',
                tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
              )}
            >
              {t(`reservations.${id}`)}
            </button>
          ))}
        </div>
        <ReservationList scope={tab} />
      </RequireAuth>
    </div>
  )
}
