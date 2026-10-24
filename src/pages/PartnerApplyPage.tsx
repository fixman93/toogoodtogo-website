import { useEffect, useState, type FormEvent } from 'react'
import { ConsentNote } from '@/components/common/LegalLinks'
import { Link, useLocation as useRouterLocation } from 'react-router'
import { ArrowDown, BadgePercent, CheckCircle2, Clock, Loader2, PlayCircle, Store, Timer, Users, Wallet, XCircle } from 'lucide-react'
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
import { PLATFORM_COMMISSION_RATE, market } from '@/config/markets'
import { demoMarketFor } from '@/features/demo/markets'
import { LossCalculator } from '@/features/partner-pitch/LossCalculator'
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
      <ConsentNote kind="partner" />
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

const BENEFITS = [
  { icon: BadgePercent, title: 'pitch.benefit1Title', text: 'pitch.benefit1Text' },
  { icon: Wallet, title: 'pitch.benefit2Title', text: 'pitch.benefit2Text' },
  { icon: Users, title: 'pitch.benefit3Title', text: 'pitch.benefit3Text' },
  { icon: Timer, title: 'pitch.benefit4Title', text: 'pitch.benefit4Text' },
] as const

/** Opened as /partner/apply#kalkulator (home page teaser): scroll there once AppShell has reset the scroll. */
function useScrollToHash() {
  const { hash } = useRouterLocation()
  useEffect(() => {
    if (!hash) return
    const frame = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    return () => cancelAnimationFrame(frame)
  }, [hash])
}

/** Public partner page: the pitch and the loss calculator for everyone, the application form for signed-in users. */
export function PartnerApplyPage() {
  const { hasRole } = useAuth()
  useScrollToHash()

  if (hasRole('business', 'admin')) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={t('apply.title')} />
        <Apply />
      </div>
    )
  }

  const demoCountry = demoMarketFor(market.code)
  const rate = Math.round(PLATFORM_COMMISSION_RATE * 100)

  return (
    <div className="space-y-10 sm:space-y-14">
      <section className="max-w-2xl pt-2">
        <p className="text-xs font-bold tracking-widest text-accent-foreground uppercase">{t('pitch.eyebrow')}</p>
        <h1 className="mt-2 text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-5xl">{t('pitch.title')}</h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">{t('pitch.text')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <a href="#prijava">
              {t('pitch.cta')}
              <ArrowDown />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to={demoCountry ? `/demo?zemlja=${demoCountry.code.toLowerCase()}` : '/demo'}>
              <PlayCircle />
              {t('pitch.demo')}
            </Link>
          </Button>
        </div>
      </section>

      <section id="kalkulator" className="scroll-mt-20">
        <LossCalculator />
      </section>

      <section>
        <h2 className="mb-5 text-xl font-extrabold tracking-tight sm:text-2xl">{t('pitch.benefitsTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="space-y-2 rounded-2xl bg-secondary p-5">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Icon className="size-5" />
              </span>
              <h3 className="font-bold text-secondary-foreground">{t(title)}</h3>
              <p className="text-sm text-secondary-foreground/80">{t(text, { rate })}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="prijava" className="mx-auto max-w-2xl scroll-mt-20">
        <PageHeader title={t('pitch.formTitle')} subtitle={t('pitch.formText')} />
        <RequireAuth>
          <Apply />
        </RequireAuth>
      </section>
    </div>
  )
}
