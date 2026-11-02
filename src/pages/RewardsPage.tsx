import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Check, Copy, Gift, Loader2, Lock, Percent, Sparkles, Ticket } from 'lucide-react'
import type { RewardCatalogItem } from '@/api/types'
import { ApiError } from '@/api/client'
import { RequireAuth } from '@/components/common/RequireAuth'
import { ErrorState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useRedeemReward, useRewards } from '@/hooks/api'
import { t } from '@/i18n'

const ICONS = { bonus_points: Sparkles, discount_percent: Percent, free_bag: Gift, voucher: Ticket } as const

function ProgressBar({ current, target }: { current: number; target: number }) {
  const pct = Math.min(100, Math.round((current / target) * 100))
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  )
}

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 font-mono text-sm font-bold"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {code}
      {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4 text-muted-foreground" />}
    </button>
  )
}

function RewardCard({ item }: { item: RewardCatalogItem }) {
  const redeem = useRedeemReward()
  const Icon = ICONS[item.type]
  const locked = item.state === 'locked'
  const left = Math.max(0, item.thresholdPickups - item.progress.current)

  return (
    <Card className={locked ? 'space-y-2 p-4 opacity-80' : 'space-y-2 p-4'}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={locked ? 'rounded-full bg-muted p-2' : 'rounded-full bg-accent/15 p-2'}>
            {locked ? <Lock className="size-5 text-muted-foreground" /> : <Icon className="size-5 text-accent-foreground" />}
          </div>
          <div>
            <p className="font-bold">{item.title}</p>
            {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
          </div>
        </div>
        {item.state === 'redeemed' && <Badge variant="success">{t('rewards.redeemed')}</Badge>}
        {item.state === 'expired' && <Badge variant="muted">{t('rewards.expired')}</Badge>}
        {item.state === 'automatic' && <Badge variant="secondary">{t('rewards.automatic')}</Badge>}
      </div>

      {(item.state === 'locked' || item.state === 'automatic') && (
        <>
          <ProgressBar current={item.progress.current} target={item.progress.target} />
          <p className="text-xs font-semibold text-muted-foreground">
            {item.state === 'automatic'
              ? t('rewards.everyN', { count: item.thresholdPickups })
              : t('rewards.leftToGo', { count: left, title: item.title })}
          </p>
        </>
      )}

      {item.state === 'unlocked' && item.type === 'free_bag' && <p className="text-sm text-success">{t('rewards.freeBagHint')}</p>}

      {item.state === 'unlocked' && (item.type === 'discount_percent' || item.type === 'voucher') && (
        <Button size="sm" className="w-full" disabled={redeem.isPending} onClick={() => item.redemptionId && redeem.mutate(item.redemptionId)}>
          {redeem.isPending && <Loader2 className="animate-spin" />}
          {t('rewards.claim')}
        </Button>
      )}
      {redeem.isError && redeem.variables === item.redemptionId && (
        <p className="text-xs text-destructive">{redeem.error instanceof ApiError ? redeem.error.message : t('common.errorText')}</p>
      )}

      {item.state === 'redeemed' && item.type === 'discount_percent' && item.promoCode && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{t('rewards.yourCode')}</p>
          <CopyCode code={item.promoCode} />
        </div>
      )}
      {item.state === 'redeemed' && item.type === 'free_bag' && <p className="text-sm text-muted-foreground">{t('rewards.freeBagUsed')}</p>}
      {item.state === 'redeemed' && item.type === 'voucher' && <p className="text-sm text-success">{t('rewards.voucherClaimed')}</p>}
    </Card>
  )
}

function RewardsView() {
  const { data, isLoading, isError, refetch } = useRewards()
  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{t('rewards.points')}</p>
          <p className="text-2xl font-extrabold tabular-nums">{data.points}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">{t('rewards.pickups')}</p>
          <p className="text-2xl font-extrabold tabular-nums">{data.totalVerifiedPickups}</p>
        </div>
      </Card>
      <div className="space-y-3">
        {data.rewards.map((item) => (
          <RewardCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

export function RewardsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Button asChild variant="ghost" className="mb-3 -ml-3">
        <Link to="/profile">
          <ArrowLeft />
          {t('nav.profile')}
        </Link>
      </Button>
      <h1 className="mb-1 text-2xl font-extrabold">{t('rewards.title')}</h1>
      <p className="mb-5 text-sm text-muted-foreground">{t('rewards.intro')}</p>
      <RequireAuth>
        <RewardsView />
      </RequireAuth>
    </div>
  )
}
