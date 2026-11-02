import { useState } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'
import type { AdminReward } from '@/api/types'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useAdminRedemptions,
  useAdminRewards,
  useLoyaltyConfig,
  useSetLoyaltyConfig,
  useSetRedemptionFulfillment,
  useUpdateReward,
} from '@/hooks/api'
import { t } from '@/i18n'
import { formatDate } from '@/lib/format'

function ConfigCard() {
  const { data, isLoading } = useLoyaltyConfig()
  const set = useSetLoyaltyConfig()
  const [pointsPerBag, setPointsPerBag] = useState('')
  if (isLoading || !data) return <Skeleton className="h-24 rounded-2xl" />
  return (
    <Card className="flex flex-wrap items-center gap-4 p-4">
      <Button size="sm" variant={data.enabled ? 'secondary' : 'outline'} disabled={set.isPending} onClick={() => set.mutate({ enabled: !data.enabled })}>
        {data.enabled ? t('admin.rewardsEnabled') : t('admin.rewardsDisabled')}
      </Button>
      <span className="flex items-center gap-1.5 text-sm">
        {t('admin.pointsPerBag')}
        <Input
          type="number"
          min={0}
          step={1}
          defaultValue={data.pointsPerBag}
          onChange={(e) => setPointsPerBag(e.target.value)}
          className="h-8 w-20 rounded-lg px-2"
        />
      </span>
      <Button size="sm" variant="outline" disabled={set.isPending || !pointsPerBag} onClick={() => set.mutate({ pointsPerBag: Number(pointsPerBag) })}>
        {set.isPending && <Loader2 className="animate-spin" />}
        {t('admin.save')}
      </Button>
    </Card>
  )
}

function RewardRow({ reward }: { reward: AdminReward }) {
  const update = useUpdateReward()
  const [threshold, setThreshold] = useState(String(reward.thresholdPickups))
  const [value, setValue] = useState(String(reward.value))
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{reward.title}</p>
        <p className="text-xs text-muted-foreground">
          {reward.key} · {reward.type}
        </p>
      </div>
      <Input type="number" min={1} value={threshold} onChange={(e) => setThreshold(e.target.value)} className="h-8 w-20 rounded-lg px-2" aria-label={t('admin.rewardThreshold')} />
      <Input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className="h-8 w-20 rounded-lg px-2" aria-label={t('admin.rewardValue')} />
      <Button
        size="sm"
        variant="outline"
        disabled={update.isPending}
        onClick={() => update.mutate({ id: reward.id, thresholdPickups: Number(threshold), value: Number(value) })}
      >
        {t('admin.save')}
      </Button>
      <Button size="sm" variant={reward.isActive ? 'secondary' : 'outline'} disabled={update.isPending} onClick={() => update.mutate({ id: reward.id, isActive: !reward.isActive })}>
        {reward.isActive ? t('admin.active') : t('admin.inactive')}
      </Button>
    </li>
  )
}

function CatalogCard() {
  const { data, isLoading, isError, refetch } = useAdminRewards()
  if (isLoading) return <Skeleton className="h-48 rounded-2xl" />
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y">
        {data.map((reward) => (
          <RewardRow key={reward.id} reward={reward} />
        ))}
      </ul>
    </Card>
  )
}

function FulfillmentNote({ redemptionId }: { redemptionId: string }) {
  const set = useSetRedemptionFulfillment()
  const [note, setNote] = useState('')
  return (
    <div className="flex gap-2">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('admin.fulfillmentPlaceholder')} className="h-8 flex-1" />
      <Button size="sm" disabled={!note.trim() || set.isPending} onClick={() => set.mutate({ id: redemptionId, note: note.trim() })}>
        {set.isPending && <Loader2 className="animate-spin" />}
        {t('admin.save')}
      </Button>
    </div>
  )
}

function RedemptionsCard() {
  const [needsFulfillment, setNeedsFulfillment] = useState(false)
  const { data, isLoading, isError, refetch } = useAdminRedemptions(needsFulfillment ? { needsFulfillment: true } : {})
  return (
    <div className="space-y-3">
      <Button size="sm" variant={needsFulfillment ? 'secondary' : 'outline'} onClick={() => setNeedsFulfillment((v) => !v)}>
        <ShieldAlert className="size-3.5" />
        {t('admin.needsFulfillment')}
      </Button>
      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : isError || !data ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data.length ? (
        <EmptyState icon={ShieldAlert} title={t('admin.noResults')} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y">
            {data.map((r) => (
              <li key={r.id} className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{r.reward?.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.user?.name} ({r.user?.email}{r.user?.phone ? `, ${r.user.phone}` : ''})
                    </p>
                  </div>
                  <Badge variant={r.status === 'redeemed' ? 'success' : r.status === 'unlocked' ? 'secondary' : 'muted'}>{r.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(r.unlockedAt)}</p>
                {r.fulfillmentNote ? (
                  <p className="text-sm">{r.fulfillmentNote}</p>
                ) : r.status === 'redeemed' && r.reward?.type === 'voucher' ? (
                  <FulfillmentNote redemptionId={r.id} />
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

export function RewardsTab() {
  return (
    <div className="space-y-5">
      <ConfigCard />
      <CatalogCard />
      <RedemptionsCard />
    </div>
  )
}
