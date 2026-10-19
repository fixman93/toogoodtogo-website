import { Link } from 'react-router'
import { ArrowLeft, Clock, Lightbulb, Loader2, Minus, Pause, Play, Plus, Repeat } from 'lucide-react'
import { ApiError } from '@/api/client'
import type { OfferSchedule } from '@/api/types'
import { ConfirmDelete } from '@/components/common/ConfirmDelete'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SuggestionHint, SuggestionTable } from '@/features/business/BagSuggestion'
import { PartnerGuard } from '@/features/business/PartnerGuard'
import { useDeleteSchedule, useMyBusinesses, useSaveSchedule, useSchedules } from '@/hooks/api'
import { t } from '@/i18n'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { WeekdayPicker } from './QuickOfferPage'

function ScheduleRow({ s, currency }: { s: OfferSchedule; currency: string }) {
  const save = useSaveSchedule()
  const remove = useDeleteSchedule()
  const patch = (body: Parameters<typeof save.mutate>[0]['body']) => save.mutate({ id: s.id, body })
  return (
    <li className={cn('space-y-3 px-4 py-4', !s.isActive && 'opacity-70')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{s.title}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {s.startTime}–{s.endTime}
            </span>
            <span>{formatMoney(s.priceMinor, currency)}</span>
            {s.businessName && <span>· {s.businessName}</span>}
          </p>
        </div>
        <Badge variant={s.isActive ? 'success' : 'muted'}>{s.isActive ? t('repeat.active') : t('repeat.paused')}</Badge>
      </div>
      <WeekdayPicker value={s.weekdays} onChange={(weekdays) => weekdays.length && patch({ weekdays })} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold">{t('repeat.perDay')}</span>
        <div className="flex items-center gap-1 rounded-full border bg-card p-1">
          <Button variant="ghost" size="icon" className="size-9" aria-label="−" disabled={s.quantity <= 1 || save.isPending} onClick={() => patch({ quantity: s.quantity - 1 })}>
            <Minus />
          </Button>
          <span className="w-8 text-center font-bold tabular-nums">{s.quantity}</span>
          <Button variant="ghost" size="icon" className="size-9" aria-label="+" disabled={save.isPending} onClick={() => patch({ quantity: s.quantity + 1 })}>
            <Plus />
          </Button>
        </div>
      </div>
      <SuggestionHint businessId={s.businessId} weekdays={s.weekdays} quantity={s.quantity} onApply={(quantity) => patch({ quantity })} />
      <p className="text-xs text-muted-foreground">{t('repeat.editNote')}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => patch({ isActive: !s.isActive })}>
          {save.isPending ? <Loader2 className="animate-spin" /> : s.isActive ? <Pause /> : <Play />}
          {s.isActive ? t('repeat.pause') : t('repeat.resume')}
        </Button>
        <ConfirmDelete
          label={t('repeat.delete')}
          question={t('repeat.deleteConfirm', { title: s.title })}
          hint={t('repeat.deleteHint')}
          onConfirm={() => remove.mutate(s.id)}
          pending={remove.isPending}
          error={remove.error}
        />
      </div>
      {save.isError && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {save.error instanceof ApiError ? save.error.message : t('common.errorText')}
        </p>
      )}
    </li>
  )
}

function Schedules() {
  const { data, isLoading, isError, refetch } = useSchedules()
  const businesses = useMyBusinesses()
  const currency = businesses.data?.data[0]?.currency ?? 'RSD'
  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />
  return (
    <div className="space-y-6">
      <Button asChild size="lg" className="w-full">
        <Link to="/business/new?repeat=1">
          <Plus />
          {t('repeat.new')}
        </Link>
      </Button>
      {data.length === 0 ? (
        <EmptyState icon={Repeat} title={t('repeat.empty')} text={t('repeat.emptyText')} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y">
            {data.map((s) => (
              <ScheduleRow key={s.id} s={s} currency={currency} />
            ))}
          </ul>
        </Card>
      )}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-bold">
          <Lightbulb className="size-5 text-accent-foreground" />
          {t('suggest.heading')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('suggest.intro')}</p>
        {businesses.data?.data.map((b) => (
          <Card key={b.id} className="space-y-2 p-4">
            <p className="font-semibold">{b.name}</p>
            <SuggestionTable businessId={b.id} />
          </Card>
        ))}
        <p className="text-xs text-muted-foreground">
          {t('suggest.legend')}
        </p>
      </section>
    </div>
  )
}

export function SchedulesPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Button asChild variant="ghost" className="mb-3 -ml-3">
        <Link to="/business">
          <ArrowLeft />
          {t('business.title')}
        </Link>
      </Button>
      <PageHeader title={t('repeat.title')} subtitle={t('repeat.intro')} />
      <PartnerGuard>
        <Schedules />
      </PartnerGuard>
    </div>
  )
}
