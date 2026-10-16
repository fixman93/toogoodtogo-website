import { useState, type FormEvent } from 'react'
import { Loader2, TicketPercent } from 'lucide-react'
import { ApiError } from '@/api/client'
import type { Promotion } from '@/api/types'
import { FormField, FormSection } from '@/components/common/FormField'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { market } from '@/config/markets'
import { useCreatePromotion, useMyBusinesses, usePromotions, useTogglePromotion } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDate, formatMoney } from '@/lib/format'
import { zonedDateTimeToUtc } from '@/lib/time'

const label = (p: Promotion) => (p.discountType === 'percent' ? `−${p.value}%` : `−${formatMoney(p.value)}`)

function PromotionForm({ platform }: { platform: boolean }) {
  const create = useCreatePromotion()
  const businesses = useMyBusinesses()
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent')
  const [value, setValue] = useState('20')
  const [businessId, setBusinessId] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [validTo, setValidTo] = useState('')

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const amount = Number(value)
    create.mutate(
      {
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        discountType,
        value: discountType === 'percent' ? Math.round(amount) : Math.round(amount * market.currencyMinorUnits),
        businessId: platform ? undefined : businessId || undefined,
        maxUses: maxUses ? Number(maxUses) : null,
        validTo: validTo ? zonedDateTimeToUtc(validTo, '23:59', market.timezone).toISOString() : undefined,
        platform,
      },
      { onSuccess: () => setCode('') },
    )
  }

  return (
    <form onSubmit={onSubmit}>
      <FormSection title={t('promo.create')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('promo.code')} htmlFor="promo-code">
            <Input id="promo-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="PEKARA20" className="font-mono uppercase" required />
          </FormField>
          <FormField label={t('promo.description')} htmlFor="promo-desc">
            <Input id="promo-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
          </FormField>
          <FormField label={t('promo.type')} htmlFor="promo-type">
            <NativeSelect id="promo-type" value={discountType} onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}>
              <option value="percent">{t('promo.percent')}</option>
              <option value="fixed">{t('promo.fixed')}</option>
            </NativeSelect>
          </FormField>
          <FormField label={t('promo.value')} htmlFor="promo-value">
            <Input id="promo-value" type="number" min={1} max={discountType === 'percent' ? 90 : undefined} value={value} onChange={(e) => setValue(e.target.value)} required />
          </FormField>
          {!platform && (
            <FormField label={t('promo.location')} htmlFor="promo-location">
              <NativeSelect id="promo-location" value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
                <option value="">{t('promo.allLocations')}</option>
                {businesses.data?.data.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )}
          <FormField label={t('promo.maxUses')} htmlFor="promo-max">
            <Input id="promo-max" type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
          </FormField>
          <FormField label={t('promo.validTo')} htmlFor="promo-valid">
            <Input id="promo-valid" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
          </FormField>
        </div>
        {create.isError && (
          <p role="alert" className="text-sm text-destructive">
            {create.error instanceof ApiError ? create.error.message : t('common.errorText')}
          </p>
        )}
        <Button type="submit" disabled={code.trim().length < 3 || !Number(value) || create.isPending}>
          {create.isPending && <Loader2 className="animate-spin" />}
          {t('promo.create')}
        </Button>
      </FormSection>
    </form>
  )
}

/** Promo codes: partner's own (default) or platform-wide (admin/operations). */
export function PromotionsManager({ platform = false }: { platform?: boolean }) {
  const { data, isLoading, isError, refetch } = usePromotions(platform ? 'platform' : 'mine')
  const toggle = useTogglePromotion()
  return (
    <div className="space-y-5">
      <PromotionForm platform={platform} />
      {isLoading ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data?.length ? (
        <EmptyState icon={TicketPercent} title={t('promo.empty')} className="py-8" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y">
            {data.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <span className="font-mono font-bold">{p.code}</span>
                    <Badge variant="accent">{label(p)}</Badge>
                    {!p.isActive && <Badge variant="muted">{t('promo.inactive')}</Badge>}
                  </p>
                  {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                  <p className="text-xs text-muted-foreground">
                    {t('promo.uses', { used: p.usesCount, max: p.maxUses ? ` / ${p.maxUses}` : '' })}
                    {p.validTo && ` · ${t('promo.validTo').replace(' (opciono)', '')}: ${formatDate(p.validTo)}`}
                  </p>
                </div>
                <Button size="sm" variant={p.isActive ? 'outline' : 'secondary'} disabled={toggle.isPending} onClick={() => toggle.mutate({ id: p.id, isActive: !p.isActive })}>
                  {p.isActive ? t('promo.deactivate') : t('promo.activate')}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
