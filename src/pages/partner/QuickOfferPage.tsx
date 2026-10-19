import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CheckCircle2, Loader2, Minus, Plus, Repeat, Settings2, ShoppingBag, Sparkles } from 'lucide-react'
import { ApiError } from '@/api/client'
import type { Business, Offer, OfferInput, OfferSchedule } from '@/api/types'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { currencyInfo } from '@/config/markets'
import { PartnerGuard } from '@/features/business/PartnerGuard'
import { useBusinessOffers, useMyBusinesses, useSaveOffer, useSaveSchedule } from '@/hooks/api'
import { SuggestionHint } from '@/features/business/BagSuggestion'
import { PickupTimePicker } from '@/features/business/PickupTimePicker'
import { isoWeekday, weekdayShort } from '@/features/business/weekdays'
import { t } from '@/i18n'
import { formatMoney, fromMinor, toMinor } from '@/lib/format'
import { addDays, toZonedInput, zonedDateTimeToUtc } from '@/lib/time'
import { cn } from '@/lib/utils'

/**
 * "Nova ponuda" in three taps: location → what (repeat a recent bag or a new
 * surprise bag) → check quantity/price/time → publish. Everything is
 * pre-filled; the full form stays one link away for photos, allergens, etc.
 */
const LAST_LOCATION_KEY = 'zalogaj.quickOffer.location'

type Template = { key: string; title: string; description: string; price: string; original: string; quantity: number; from: string; to: string; source?: Offer }

const readLastLocation = () => {
  try {
    return localStorage.getItem(LAST_LOCATION_KEY)
  } catch {
    return null
  }
}

/** Distinct recent offers of a location, newest first (by title). */
function recentTemplates(offers: Offer[]): Template[] {
  const seen = new Set<string>()
  return [...offers]
    .sort((a, b) => b.pickupStart.localeCompare(a.pickupStart))
    .filter((o) => (seen.has(o.title) ? false : (seen.add(o.title), true)))
    .slice(0, 4)
    .map((o) => ({
      key: o.id,
      title: o.title,
      description: o.description,
      price: String(fromMinor(o.basePriceMinor ?? o.priceMinor, o.currency)),
      original: String(fromMinor(o.originalPriceMinor, o.currency)),
      quantity: o.quantityTotal,
      from: toZonedInput(o.pickupStart, o.timezone).time,
      to: toZonedInput(o.pickupEnd, o.timezone).time,
      source: o,
    }))
}

function freshTemplate(business: Business, recent: Template[]): Template {
  const last = recent[0]
  return {
    key: 'new',
    title: t('partner.template.title'),
    description: t(`partner.template.${business.category}`),
    price: last?.price ?? '',
    original: last?.original ?? '',
    quantity: last?.quantity ?? 5,
    from: last?.from ?? '19:00',
    to: last?.to ?? '20:30',
  }
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="icon" className="size-12 rounded-full" aria-label="−" onClick={() => onChange(Math.max(1, value - 1))}>
        <Minus />
      </Button>
      <span className="w-12 text-center text-3xl font-extrabold tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button type="button" variant="outline" size="icon" className="size-12 rounded-full" aria-label="+" onClick={() => onChange(Math.min(500, value + 1))}>
        <Plus />
      </Button>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 font-bold">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

/** Mon–Sun chips for a repeating offer. */
export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  return (
    <div className="flex gap-1.5" role="group" aria-label={t('repeat.days')}>
      {[1, 2, 3, 4, 5, 6, 7].map((d) => {
        const on = value.includes(d)
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())}
            className={cn('h-10 flex-1 rounded-full border text-xs font-bold', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}
          >
            {weekdayShort(d)}
          </button>
        )
      })}
    </div>
  )
}

function OfferBuilder({ business, onPublished }: { business: Business; onPublished: (o: Offer | OfferSchedule) => void }) {
  const offers = useBusinessOffers(business.id)
  const save = useSaveOffer()
  const saveSchedule = useSaveSchedule()
  // Repeat on chosen weekdays (Mon–Sat by default when switched on).
  const [params] = useSearchParams()
  const [repeat, setRepeat] = useState(() => params.get('repeat') === '1')
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6])
  const recent = useMemo(() => recentTemplates(offers.data?.data ?? []), [offers.data])
  const fresh = useMemo(() => freshTemplate(business, recent), [business, recent])
  const templates = [...recent, fresh]
  const [selected, setSelected] = useState<string | null>(null)
  const chosen = templates.find((x) => x.key === selected) ?? templates[0]
  // Edits on top of the chosen template (reset when another one is picked).
  const [edits, setEdits] = useState<Partial<Template> & { day?: 'today' | 'tomorrow' }>({})
  const form = { ...chosen, ...edits }
  const tz = business.timezone
  const today = toZonedInput(new Date(), tz).date
  // Today if the pickup window hasn't ended yet, otherwise tomorrow.
  const autoDay = zonedDateTimeToUtc(today, form.to, tz) > new Date() ? 'today' : 'tomorrow'
  const day = edits.day ?? autoDay
  const date = day === 'today' ? today : addDays(today, 1)
  const { displayDecimals } = currencyInfo(business.currency)
  // Fast time entry: start times this location used before, and "now" for today's offers.
  const recentStarts = useMemo(() => [...new Set(recent.map((x) => x.from))], [recent])
  const nowLocal = toZonedInput(new Date(), tz).time
  const price = Number(form.price.replace(',', '.'))
  const original = Number(form.original.replace(',', '.'))

  const problems = [
    !(price > 0) && t('quick.errorPrice'),
    original > 0 && price >= original && t('partner.error.priceLower'),
    form.to <= form.from && t('quick.errorTime'),
    !repeat && day === 'today' && zonedDateTimeToUtc(date, form.to, tz) <= new Date() && t('quick.errorPast'),
    repeat && weekdays.length === 0 && t('repeat.errorDays'),
  ].filter(Boolean) as string[]

  const pick = (key: string) => {
    setSelected(key)
    setEdits({})
  }
  const set = (patch: Partial<Template> & { day?: 'today' | 'tomorrow' }) => setEdits((e) => ({ ...e, ...patch }))

  const publish = () => {
    const priceMinor = toMinor(price, business.currency)
    const body: OfferInput = {
      businessId: business.id,
      title: form.title.trim() || t('partner.template.title'),
      description: form.description,
      category: form.source?.category ?? business.category,
      contentType: form.source?.contentType ?? 'surprise',
      contents: form.source?.contents,
      allergens: form.source?.allergens,
      tags: form.source?.tags,
      priceMinor,
      // No regular price typed: assume the usual ~⅓ of the value.
      originalPriceMinor: original > 0 ? toMinor(original, business.currency) : priceMinor * 3,
      quantityTotal: form.quantity,
      pickupStart: zonedDateTimeToUtc(date, form.from, tz).toISOString(),
      pickupEnd: zonedDateTimeToUtc(date, form.to, tz).toISOString(),
    }
    if (repeat) {
      // The schedule publishes today's/tomorrow's offers itself.
      saveSchedule.mutate(
        {
          body: {
            businessId: business.id,
            title: body.title,
            description: body.description,
            category: body.category,
            priceMinor: body.priceMinor,
            originalPriceMinor: body.originalPriceMinor,
            quantity: form.quantity,
            startTime: form.from,
            endTime: form.to,
            weekdays,
          },
        },
        { onSuccess: onPublished },
      )
      return
    }
    save.mutate({ body }, { onSuccess: onPublished })
  }
  const pending = save.isPending || saveSchedule.isPending
  const error = save.error ?? saveSchedule.error

  if (offers.isLoading) return <Skeleton className="h-64 rounded-2xl" />

  return (
    <div className="space-y-6">
      <Step n={2} title={t('quick.what')}>
        <div className="grid gap-2 sm:grid-cols-2">
          {templates.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => pick(x.key)}
              aria-pressed={chosen.key === x.key}
              className={cn(
                'flex items-start gap-3 rounded-2xl border-2 bg-card p-3 text-left transition-colors',
                chosen.key === x.key ? 'border-primary bg-secondary/60' : 'border-transparent shadow-card hover:border-border',
              )}
            >
              {x.source ? <ShoppingBag className="mt-0.5 size-5 shrink-0 text-primary" /> : <Sparkles className="mt-0.5 size-5 shrink-0 text-accent-foreground" />}
              <span className="min-w-0">
                <span className="block truncate font-semibold">{x.source ? x.title : t('quick.newBag')}</span>
                <span className="block text-xs text-muted-foreground">
                  {x.source ? `${t('quick.repeat')} · ${x.price ? formatMoney(toMinor(Number(x.price), business.currency), business.currency) : ''} · ${x.quantity} × · ${x.from}–${x.to}` : t('quick.newBagHint')}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Step>

      <Step n={3} title={t('quick.details')}>
        <Card className="space-y-5 p-4">
          <label className="block space-y-1 text-sm font-semibold">
            {t('quick.name')}
            <Input value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold">{t('partner.field.quantity')}</span>
            <Stepper value={form.quantity} onChange={(quantity) => set({ quantity })} />
          </div>
          <SuggestionHint businessId={business.id} weekdays={repeat ? weekdays : [isoWeekday(date)]} quantity={form.quantity} onApply={(quantity) => set({ quantity })} />

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-sm font-semibold">
              {t('partner.field.price', { currency: business.currency })}
              <Input
                type="number"
                inputMode={displayDecimals ? 'decimal' : 'numeric'}
                step={displayDecimals ? 0.01 : 1}
                min={0}
                value={form.price}
                onChange={(e) => set({ price: e.target.value })}
                className="text-lg font-bold"
              />
            </label>
            <label className="space-y-1 text-sm font-semibold">
              {t('partner.field.originalPrice', { currency: business.currency })}
              <Input
                type="number"
                inputMode={displayDecimals ? 'decimal' : 'numeric'}
                step={displayDecimals ? 0.01 : 1}
                min={0}
                value={form.original}
                placeholder={price > 0 ? String(fromMinor(toMinor(price, business.currency) * 3, business.currency)) : ''}
                onChange={(e) => set({ original: e.target.value })}
              />
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-semibold">{t('quick.when')}</span>
            <label className="flex min-h-11 items-center gap-3 rounded-xl border bg-card px-3 text-sm">
              <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="size-5 accent-[var(--primary)]" />
              <span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Repeat className="size-4 text-primary" />
                  {t('repeat.toggle')}
                </span>
                <span className="block text-xs text-muted-foreground">{t('repeat.toggleHint')}</span>
              </span>
            </label>
            {repeat ? (
              <WeekdayPicker value={weekdays} onChange={setWeekdays} />
            ) : (
            <div className="flex gap-2">
              {(['today', 'tomorrow'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set({ day: d })}
                  className={cn('h-11 flex-1 rounded-full border text-sm font-semibold', day === d ? 'border-primary bg-secondary text-primary' : 'bg-card')}
                >
                  {t(d === 'today' ? 'common.today' : 'common.tomorrow')}
                </button>
              ))}
            </div>
            )}
            <PickupTimePicker
              from={form.from}
              to={form.to}
              onChange={({ from, to }) => set({ from, to })}
              recent={recentStarts}
              now={!repeat && day === 'today' ? nowLocal : undefined}
            />
          </div>
        </Card>
      </Step>

      {problems.length > 0 && (
        <ul className="space-y-1 text-sm font-semibold text-destructive">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error instanceof ApiError ? error.message : t('common.errorText')}
        </p>
      )}
      <Button size="lg" className="h-14 w-full text-lg" disabled={problems.length > 0 || pending} onClick={publish}>
        {pending ? <Loader2 className="animate-spin" /> : repeat ? <Repeat /> : <CheckCircle2 />}
        {repeat ? t('repeat.publish', { count: form.quantity }) : t('quick.publish', { count: form.quantity })}
      </Button>
      <Link
        to={`/business/offers/new?businessId=${business.id}${form.source ? `&copy=${form.source.id}` : ''}`}
        className="flex items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground underline"
      >
        <Settings2 className="size-4" />
        {t('quick.advanced')}
      </Link>
    </div>
  )
}

function QuickOffer() {
  const { data, isLoading } = useMyBusinesses()
  const businesses = (data?.data ?? []).filter((b) => b.isActive)
  const [businessId, setBusinessId] = useState<string | null>(readLastLocation)
  const [published, setPublished] = useState<Offer | OfferSchedule | null>(null)
  const business = businesses.find((b) => b.id === businessId) ?? businesses[0]

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />
  if (!business) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title={t('business.empty')}
        action={
          <Button asChild>
            <Link to="/business/locations/new">{t('partner.addFirstLocation')}</Link>
          </Button>
        }
      />
    )
  }

  if (published) {
    return (
      <Card className="space-y-4 border-2 border-success bg-success/10 p-6 text-center">
        <CheckCircle2 className="mx-auto size-12 text-success" />
        <p className="text-xl font-extrabold">{'weekdays' in published ? t('repeat.done') : t('quick.done')}</p>
        {'weekdays' in published ? (
          <p className="text-sm">
            {published.quantity} × {published.title} · {formatMoney(published.priceMinor, business.currency)} · {published.startTime}–{published.endTime} ·{' '}
            {published.weekdays.map(weekdayShort).join(', ')}
          </p>
        ) : (
          <p className="text-sm">
            {published.quantityTotal} × {published.title} · {formatMoney(published.priceMinor, published.currency)} · {toZonedInput(published.pickupStart, published.timezone).time}–
            {toZonedInput(published.pickupEnd, published.timezone).time}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button size="lg" onClick={() => setPublished(null)}>
            <Plus />
            {t('quick.another')}
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to={'weekdays' in published ? '/business/schedules' : '/business'}>{'weekdays' in published ? t('repeat.title') : t('business.title')}</Link>
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Step n={1} title={t('quick.where')}>
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {businesses.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setBusinessId(b.id)
                try {
                  localStorage.setItem(LAST_LOCATION_KEY, b.id)
                } catch {
                  /* ignore */
                }
              }}
              aria-pressed={business.id === b.id}
              className={cn(
                'shrink-0 rounded-2xl border-2 px-4 py-2.5 text-left text-sm',
                business.id === b.id ? 'border-primary bg-secondary/60 font-semibold' : 'border-border bg-card',
              )}
            >
              <span className="block font-semibold">{b.name}</span>
              <span className="block text-xs text-muted-foreground">{b.address.street}</span>
            </button>
          ))}
        </div>
      </Step>
      <OfferBuilder key={business.id} business={business} onPublished={setPublished} />
    </div>
  )
}

export function QuickOfferPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('quick.title')} subtitle={t('quick.intro')} />
      <PartnerGuard>
        <QuickOffer />
      </PartnerGuard>
    </div>
  )
}
