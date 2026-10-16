import { useState, type FormEvent } from 'react'
import { HandHeart, Loader2 } from 'lucide-react'
import { ApiError } from '@/api/client'
import type { DonationList } from '@/api/types'
import { ConfirmDelete } from '@/components/common/ConfirmDelete'
import { FormField, FormSection } from '@/components/common/FormField'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { market } from '@/config/markets'
import { PartnerPageShell } from '@/features/business/PartnerPageShell'
import { useAddDonation, useDeleteDonation, useDonations, useMyBusinesses } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDate } from '@/lib/format'
import { toZonedInput, zonedDateTimeToUtc } from '@/lib/time'

/** Donations list (+ delete) — also used read-only in the admin panel. */
export function DonationTable({ list, canDelete }: { list: DonationList; canDelete?: boolean }) {
  const remove = useDeleteDonation()
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{t('donations.total', { count: list.totals.count, bags: list.totals.bags, kg: list.totals.weightKg })}</p>
      {!list.items.length ? (
        <EmptyState icon={HandHeart} title={t('donations.empty')} className="py-8" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y">
            {list.items.map((d) => (
              <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {d.organization} · {d.bags} {d.weightKg ? `· ${d.weightKg} kg` : ''}
                  </p>
                  <p className="text-muted-foreground">
                    {d.businessName} · {formatDate(d.date)}
                    {d.pickedUpBy && ` · ${d.pickedUpBy}`}
                  </p>
                  {d.items && <p className="text-muted-foreground">{d.items}</p>}
                </div>
                {canDelete && (
                  <ConfirmDelete label={t('partner.deleteShort')} question={t('partner.deleteShort') + '?'} onConfirm={() => remove.mutate(d.id)} pending={remove.isPending} error={remove.error} />
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function DonationForm() {
  const businesses = useMyBusinesses()
  const add = useAddDonation()
  const today = toZonedInput(new Date(), market.timezone).date
  const [form, setForm] = useState({ businessId: '', date: today, organization: '', bags: '1', weightKg: '', items: '', pickedUpBy: '' })
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))
  const businessId = form.businessId || businesses.data?.data[0]?.id || ''

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    add.mutate(
      {
        businessId,
        date: zonedDateTimeToUtc(form.date, '12:00', market.timezone).toISOString(),
        organization: form.organization.trim(),
        bags: Number(form.bags) || 0,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        items: form.items.trim() || undefined,
        pickedUpBy: form.pickedUpBy.trim() || undefined,
      },
      { onSuccess: () => setForm((f) => ({ ...f, organization: '', items: '', pickedUpBy: '', weightKg: '' })) },
    )
  }

  return (
    <form onSubmit={onSubmit}>
      <FormSection title={t('donations.add')}>
        <p className="text-xs text-muted-foreground">{t('donations.safety')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('partner.field.business')} htmlFor="d-business">
            <NativeSelect id="d-business" value={businessId} onChange={(e) => set('businessId', e.target.value)}>
              {businesses.data?.data.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('donations.date')} htmlFor="d-date">
            <Input id="d-date" type="date" max={today} value={form.date} onChange={(e) => set('date', e.target.value)} />
          </FormField>
          <FormField label={t('donations.organization')} htmlFor="d-org">
            <Input id="d-org" value={form.organization} onChange={(e) => set('organization', e.target.value)} placeholder="Banka hrane Beograd" required />
          </FormField>
          <FormField label={t('donations.bags')} htmlFor="d-bags">
            <Input id="d-bags" type="number" min={0} value={form.bags} onChange={(e) => set('bags', e.target.value)} />
          </FormField>
          <FormField label={t('donations.weight')} htmlFor="d-kg">
            <Input id="d-kg" type="number" min={0} step="0.1" value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} />
          </FormField>
          <FormField label={t('donations.pickedUpBy')} htmlFor="d-by">
            <Input id="d-by" value={form.pickedUpBy} onChange={(e) => set('pickedUpBy', e.target.value)} />
          </FormField>
        </div>
        <FormField label={t('donations.items')} htmlFor="d-items">
          <Input id="d-items" value={form.items} onChange={(e) => set('items', e.target.value)} />
        </FormField>
        {add.isError && (
          <p role="alert" className="text-sm text-destructive">
            {add.error instanceof ApiError ? add.error.message : t('common.errorText')}
          </p>
        )}
        <Button type="submit" disabled={!businessId || form.organization.trim().length < 2 || add.isPending}>
          {add.isPending && <Loader2 className="animate-spin" />}
          {t('donations.add')}
        </Button>
      </FormSection>
    </form>
  )
}

function Donations() {
  const { data, isLoading, isError, refetch } = useDonations()
  return (
    <div className="space-y-5">
      <DonationForm />
      {isLoading ? <Skeleton className="h-32 rounded-2xl" /> : isError || !data ? <ErrorState onRetry={() => refetch()} /> : <DonationTable list={data} canDelete />}
    </div>
  )
}

export function DonationsPage() {
  return (
    <PartnerPageShell title={t('donations.title')} intro={t('donations.intro')}>
      <Donations />
    </PartnerPageShell>
  )
}
