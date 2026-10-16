import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { CheckCircle2, Clock, Loader2, Store, XCircle } from 'lucide-react'
import { ApiError } from '@/api/client'
import { CATEGORIES, type Category, type PartnerApplicationInput } from '@/api/types'
import { FormField, FormSection } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { RequireAuth } from '@/components/common/RequireAuth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { market } from '@/config/markets'
import { useAuth } from '@/features/auth/auth-context'
import { useApplyAsPartner, useMyApplication } from '@/hooks/api'
import { t } from '@/i18n'

function ApplicationForm({ onDone }: { onDone?: () => void }) {
  const { user } = useAuth()
  const apply = useApplyAsPartner()
  const [form, setForm] = useState<PartnerApplicationInput>({
    businessName: '',
    contactName: user?.name ?? '',
    phone: '',
    city: market.cities[0].name,
    countryCode: market.code,
    category: 'bakery',
    locationsCount: 1,
    message: '',
  })
  const set = <K extends keyof PartnerApplicationInput>(key: K, value: PartnerApplicationInput[K]) => setForm((f) => ({ ...f, [key]: value }))
  const valid = form.businessName.trim().length >= 2 && form.contactName.trim().length >= 2 && form.phone.trim().length >= 6 && form.city.trim().length >= 2

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    apply.mutate({ ...form, message: form.message?.trim() || undefined }, { onSuccess: onDone })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormSection title={t('apply.title')}>
        <FormField label={t('apply.businessName')} htmlFor="businessName">
          <Input id="businessName" value={form.businessName} onChange={(e) => set('businessName', e.target.value)} required />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('apply.contactName')} htmlFor="contactName">
            <Input id="contactName" value={form.contactName} onChange={(e) => set('contactName', e.target.value)} autoComplete="name" required />
          </FormField>
          <FormField label={t('apply.phone')} htmlFor="phone">
            <Input id="phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+381 6x xxx xxxx" required />
          </FormField>
          <FormField label={t('apply.city')} htmlFor="city">
            <Input id="city" list="apply-cities" value={form.city} onChange={(e) => set('city', e.target.value)} required />
            <datalist id="apply-cities">
              {market.cities.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </FormField>
          <FormField label={t('apply.category')} htmlFor="category">
            <NativeSelect id="category" value={form.category} onChange={(e) => set('category', e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`category.${c}`)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('apply.locationsCount')} htmlFor="locationsCount">
            <Input id="locationsCount" type="number" min={1} max={500} value={form.locationsCount} onChange={(e) => set('locationsCount', Number(e.target.value) || 1)} />
          </FormField>
        </div>
        <FormField label={t('apply.message')} htmlFor="message">
          <Textarea id="message" value={form.message} onChange={(e) => set('message', e.target.value)} maxLength={1000} />
        </FormField>
      </FormSection>
      {apply.isError && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {apply.error instanceof ApiError ? apply.error.message : t('common.errorText')}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={!valid || apply.isPending}>
        {apply.isPending && <Loader2 className="animate-spin" />}
        {t('apply.submit')}
      </Button>
    </form>
  )
}

function Apply() {
  const { hasRole } = useAuth()
  const { data: application, isLoading } = useMyApplication()
  const [again, setAgain] = useState(false)

  if (hasRole('business', 'admin')) {
    return (
      <Card className="flex flex-col items-center gap-3 p-6 text-center">
        <Store className="size-8 text-primary" />
        <p className="font-semibold">{t('apply.alreadyPartner')}</p>
        <Button asChild>
          <Link to="/business">{t('apply.openPortal')}</Link>
        </Button>
      </Card>
    )
  }
  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />

  if (application && !again) {
    const { status } = application
    const Icon = status === 'approved' ? CheckCircle2 : status === 'rejected' ? XCircle : Clock
    return (
      <Card className="space-y-3 p-6 text-center">
        <Icon className={status === 'rejected' ? 'mx-auto size-8 text-destructive' : 'mx-auto size-8 text-primary'} />
        <p className="font-bold">{application.businessName}</p>
        <p className="text-sm text-muted-foreground">{t(`apply.${status}`)}</p>
        {application.reviewNote && <p className="rounded-xl bg-muted p-3 text-sm">{application.reviewNote}</p>}
        {status === 'approved' && (
          <Button asChild>
            <Link to="/business">{t('apply.openPortal')}</Link>
          </Button>
        )}
        {status === 'rejected' && (
          <Button variant="outline" onClick={() => setAgain(true)}>
            {t('apply.applyAgain')}
          </Button>
        )}
      </Card>
    )
  }
  return <ApplicationForm onDone={() => setAgain(false)} />
}

export function PartnerApplyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('apply.title')} subtitle={t('apply.intro')} />
      <RequireAuth>
        <Apply />
      </RequireAuth>
    </div>
  )
}
