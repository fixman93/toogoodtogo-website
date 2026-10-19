import { useState } from 'react'
import { BellRing, CheckCircle2, Loader2, Megaphone, TrendingUp } from 'lucide-react'
import { ApiError } from '@/api/client'
import type { BoostKind } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBoostOptions, useBuyBoost } from '@/hooks/api'
import { t } from '@/i18n'
import { formatMoney } from '@/lib/format'

/**
 * "Istakni" for one offer: listed first, or a push to followers and recent
 * customers. No online payment — the price goes on the monthly statement.
 */
export function BoostPanel({ offerId }: { offerId: string }) {
  const { data, isLoading } = useBoostOptions(offerId)
  const buy = useBuyBoost()
  const [confirm, setConfirm] = useState<BoostKind | null>(null)
  if (isLoading || !data) return <Skeleton className="h-32 rounded-xl" />

  const options: { kind: BoostKind; icon: typeof TrendingUp; title: string; text: string; bought: boolean; done: string }[] = [
    { kind: 'top', icon: TrendingUp, title: t('boost.top'), text: t('boost.topText'), bought: data.top.bought, done: t('boost.topDone') },
    {
      kind: 'push',
      icon: BellRing,
      title: t('boost.push'),
      text: t('boost.pushText', { count: data.push.audience }),
      bought: data.push.bought,
      done: t('boost.pushDone', { count: data.push.recipients ?? 0 }),
    },
  ]

  return (
    <div className="space-y-2 rounded-xl border bg-muted/40 p-3">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Megaphone className="size-4 text-primary" />
        {t('boost.title')}
      </p>
      {options.map(({ kind, icon: Icon, title, text, bought, done }) => {
        const price = kind === 'top' ? data.top.priceMinor : data.push.priceMinor
        const noAudience = kind === 'push' && !bought && data.push.audience === 0
        return (
          <div key={kind} className="space-y-2 rounded-lg bg-card p-3">
            <div className="flex items-start gap-2">
              <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground">{noAudience ? t('boost.noAudience') : text}</p>
              </div>
              <span className="shrink-0 text-sm font-extrabold">{formatMoney(price, data.currency)}</span>
            </div>
            {bought ? (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
                <CheckCircle2 className="size-4" />
                {done}
              </p>
            ) : confirm === kind ? (
              <div className="space-y-2">
                <p className="text-xs">{t('boost.confirm', { price: formatMoney(price, data.currency) })}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setConfirm(null)}>
                    {t('common.cancel')}
                  </Button>
                  <Button size="sm" className="flex-1" disabled={buy.isPending} onClick={() => buy.mutate({ offerId, kind }, { onSettled: () => setConfirm(null) })}>
                    {buy.isPending && <Loader2 className="animate-spin" />}
                    {t('boost.confirmYes')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="secondary" className="w-full" disabled={noAudience} onClick={() => setConfirm(kind)}>
                {t('boost.buy', { price: formatMoney(price, data.currency) })}
              </Button>
            )}
          </div>
        )
      })}
      {buy.isError && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {buy.error instanceof ApiError ? buy.error.message : t('common.errorText')}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t('boost.billing')}</p>
    </div>
  )
}
