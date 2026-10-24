import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, Loader2, Pause, Play, Sparkles, Store, Trash2 } from 'lucide-react'
import { ApiError } from '@/api/client'
import { ALLERGENS, CATEGORIES, type Allergen, type Business, type Category, type Offer, type OfferInput } from '@/api/types'
import { FormField, FormSection } from '@/components/common/FormField'
import { ImageUpload } from '@/components/common/ImageUpload'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { currencyInfo, market } from '@/config/markets'
import { PartnerGuard } from '@/features/business/PartnerGuard'
import { PartnerTermsGate } from '@/features/business/PartnerTermsNotice'
import { useDeleteOffer, useMyBusinesses, useOffer, useSaveOffer, useSuggestion } from '@/hooks/api'
import { t } from '@/i18n'
import { discountPercent, formatMoney } from '@/lib/format'
import { addDays, toZonedInput, zonedDateTimeToUtc } from '@/lib/time'
import { cn } from '@/lib/utils'

const TAGS = ['vegetarian', 'vegan'] as const

interface FormState {
  businessId: string
  title: string
  description: string
  category: Category
  tags: string[]
  contentType: 'surprise' | 'known'
  contents: string
  allergens: Allergen[]
  originalPrice: string
  price: string
  quantity: string
  maxPer: string
  date: string
  from: string
  to: string
  dropOn: boolean
  imageUrl: string
  dropTime: string
  dropPrice: string
}

type Mode = { kind: 'new' } | { kind: 'copy'; source: Offer } | { kind: 'edit'; offer: Offer }

const today = () => toZonedInput(new Date(), market.timezone).date

/** First date ≥ `date` (and ≥ today) on which the window hasn't ended yet. */
function nextOpenDate(date: string, to: string, timeZone: string) {
  let d = date < today() ? today() : date
  if (zonedDateTimeToUtc(d, to, timeZone) <= new Date()) d = addDays(d, 1)
  return d
}

function initialState(mode: Mode, businesses: Business[], preferredBusinessId: string | null): FormState {
  const source = mode.kind === 'edit' ? mode.offer : mode.kind === 'copy' ? mode.source : null
  if (source) {
    const { minorUnits } = currencyInfo(source.currency)
    const start = toZonedInput(source.pickupStart, source.timezone)
    const end = toZonedInput(source.pickupEnd, source.timezone)
    return {
      businessId: source.businessId,
      title: source.title,
      description: source.description,
      category: source.category,
      tags: source.tags,
      contentType: source.contentType ?? 'surprise',
      contents: (source.contents ?? []).join('\n'),
      allergens: source.allergens ?? [],
      originalPrice: String(source.originalPriceMinor / minorUnits),
      price: String((source.basePriceMinor ?? source.priceMinor) / minorUnits),
      quantity: String(source.quantityTotal),
      maxPer: String(source.maxPerReservation),
      date: mode.kind === 'copy' ? nextOpenDate(addDays(start.date, 1), end.time, source.timezone) : start.date,
      from: start.time,
      to: end.time,
      dropOn: !!source.priceDrop,
      // Only the offer's own photo (not the location cover it falls back to).
      imageUrl: source.imageUrl && source.imageUrl !== businesses.find((b) => b.id === source.businessId)?.coverUrl ? source.imageUrl : '',
      dropTime: source.priceDrop ? toZonedInput(source.priceDrop.at, source.timezone).time : '',
      dropPrice: source.priceDrop ? String(source.priceDrop.priceMinor / minorUnits) : '',
    }
  }
  const business = businesses.find((b) => b.id === preferredBusinessId) ?? businesses[0]
  return {
    businessId: business.id,
    title: t('partner.template.title'),
    description: t(`partner.template.${business.category}`),
    category: business.category,
    tags: [],
    contentType: 'surprise',
    contents: '',
    allergens: [],
    originalPrice: '',
    price: '',
    quantity: '5',
    maxPer: '2',
    date: nextOpenDate(today(), '20:00', business.timezone),
    from: '19:00',
    to: '20:00',
    dropOn: false,
    imageUrl: '',
    dropTime: '',
    dropPrice: '',
  }
}

function OfferForm({ mode, businesses, preferredBusinessId }: { mode: Mode; businesses: Business[]; preferredBusinessId: string | null }) {
  const navigate = useNavigate()
  const save = useSaveOffer()
  const remove = useDeleteOffer()
  const [form, setForm] = useState<FormState>(() => initialState(mode, businesses, preferredBusinessId))
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const editing = mode.kind === 'edit' ? mode.offer : null
  const reserved = editing ? editing.quantityTotal - editing.quantityAvailable : 0
  const business = businesses.find((b) => b.id === form.businessId)
  const timezone = business?.timezone ?? market.timezone
  // Prices are entered in the location's own currency (RSD, BAM, EUR, …).
  const currency = business?.currency ?? market.currency
  const { minorUnits, displayDecimals } = currencyInfo(currency)
  const moneyInput = displayDecimals ? { inputMode: 'decimal' as const, step: 0.01, min: 0.01 } : { inputMode: 'numeric' as const, min: 1 }
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    // A field's error disappears as soon as the user edits it.
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))
  }
  const field = (key: Exclude<keyof FormState, 'tags' | 'category' | 'contentType' | 'allergens' | 'dropOn' | 'imageUrl'>) => ({
    id: key,
    value: form[key],
    'aria-invalid': !!errors[key] || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(key, e.target.value),
  })

  const original = Number(form.originalPrice)
  const price = Number(form.price)
  const showPreview = original > 0 && price > 0 && price < original
  const suggestion = useSuggestion(editing ? undefined : form.businessId, form.date)
  const dropPrice = Number(form.dropPrice)

  const validate = () => {
    const next: typeof errors = {}
    if (form.title.trim().length < 2) next.title = t('partner.error.required')
    if (form.description.trim().length < 10) next.description = t('partner.error.required')
    if (form.contentType === 'known' && !form.contents.trim()) next.contents = t('partner.error.required')
    if (!(original > 0)) next.originalPrice = t('partner.error.positive')
    if (!(price > 0)) next.price = t('partner.error.positive')
    else if (price >= original) next.price = t('partner.error.priceLower')
    const quantity = Number(form.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) next.quantity = t('partner.error.positive')
    else if (quantity < reserved) next.quantity = t('partner.error.belowReserved', { count: reserved })
    if (!(Number(form.maxPer) >= 1)) next.maxPer = t('partner.error.positive')
    if (!form.date) next.date = t('partner.error.required')
    if (form.to <= form.from) next.to = t('partner.error.timeOrder')
    else if (form.date && zonedDateTimeToUtc(form.date, form.to, timezone) <= new Date()) next.to = t('partner.error.past')
    if (form.dropOn && (!(dropPrice > 0) || dropPrice >= price || !form.dropTime || form.dropTime >= form.to)) next.dropPrice = t('partner.error.priceDrop')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const body: Omit<OfferInput, 'businessId'> = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      tags: form.tags,
      contentType: form.contentType,
      contents: form.contentType === 'known' ? form.contents.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 20) : [],
      allergens: form.allergens,
      imageUrl: form.imageUrl,
      priceMinor: Math.round(price * minorUnits),
      originalPriceMinor: Math.round(original * minorUnits),
      quantityTotal: Number(form.quantity),
      maxPerReservation: Number(form.maxPer),
      pickupStart: zonedDateTimeToUtc(form.date, form.from, timezone).toISOString(),
      pickupEnd: zonedDateTimeToUtc(form.date, form.to, timezone).toISOString(),
      // Dynamic pricing; null removes an existing drop when editing.
      priceDrop: form.dropOn
        ? { at: zonedDateTimeToUtc(form.date, form.dropTime, timezone).toISOString(), priceMinor: Math.round(dropPrice * minorUnits) }
        : editing?.priceDrop
          ? null
          : undefined,
    }
    const done = { onSuccess: () => navigate('/business') }
    if (editing) save.mutate({ id: editing.id, body }, done)
    else save.mutate({ body: { ...body, businessId: form.businessId } }, done)
  }

  const error = save.error ?? remove.error
  const dateChoices = [
    { value: today(), label: t('common.today') },
    { value: addDays(today(), 1), label: t('common.tomorrow') },
  ]

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-2xl space-y-5">
      <FormSection title={t('partner.section.offer')}>
        <FormField label={t('partner.field.business')} htmlFor="businessId">
          <NativeSelect
            {...field('businessId')}
            disabled={!!editing}
            onChange={(e) => {
              const next = businesses.find((b) => b.id === e.target.value)
              setForm((f) => ({ ...f, businessId: e.target.value, category: next?.category ?? f.category }))
            }}
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} – {b.address.street}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label={t('partner.field.title')} htmlFor="title" error={errors.title}>
          <Input {...field('title')} maxLength={120} />
        </FormField>
        <FormField label={t('partner.field.offerDescription')} htmlFor="description" error={errors.description}>
          <Textarea {...field('description')} maxLength={2000} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('partner.field.category')} htmlFor="category">
            <NativeSelect id="category" value={form.category} onChange={(e) => set('category', e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`category.${c}`)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label={t('partner.field.tags')}>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((tag) => {
                const on = form.tags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set('tags', on ? form.tags.filter((x) => x !== tag) : [...form.tags, tag])}
                    className={cn(
                      'h-11 rounded-full border px-4 text-sm font-semibold transition-colors',
                      on ? 'border-primary bg-secondary text-primary' : 'bg-card hover:bg-muted',
                    )}
                  >
                    {t(`partner.tag.${tag}`)}
                  </button>
                )
              })}
            </div>
          </FormField>
        </div>
      </FormSection>

      <FormSection title={t('partner.field.offerImage')}>
        <ImageUpload kind="offer" value={form.imageUrl} onChange={(url) => set('imageUrl', url)} />
        <p className="text-xs text-muted-foreground">{t('partner.field.offerImageHint')}</p>
      </FormSection>

      <FormSection title={t('partner.field.contentType')}>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {(['surprise', 'known'] as const).map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={form.contentType === type}
              onClick={() => set('contentType', type)}
              className={cn(
                'h-11 rounded-full border px-4 text-sm font-semibold transition-colors',
                form.contentType === type ? 'border-primary bg-secondary text-primary' : 'bg-card hover:bg-muted',
              )}
            >
              {t(`partner.contentType.${type}`)}
            </button>
          ))}
        </div>
        {form.contentType === 'known' && (
          <FormField label={t('partner.field.contents')} htmlFor="contents" error={errors.contents} hint={t('partner.field.contentsHint')}>
            <Textarea {...field('contents')} placeholder={'3 bureka\n2 sendviča'} />
          </FormField>
        )}
        <FormField label={t('partner.field.allergens')} hint={t('partner.field.allergensHint')}>
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((a) => {
              const on = form.allergens.includes(a)
              return (
                <button
                  key={a}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set('allergens', on ? form.allergens.filter((x) => x !== a) : [...form.allergens, a])}
                  className={cn('h-9 rounded-full border px-3 text-sm font-medium transition-colors', on ? 'border-primary bg-secondary text-primary' : 'bg-card hover:bg-muted')}
                >
                  {t(`allergen.${a}`)}
                </button>
              )
            })}
          </div>
        </FormField>
      </FormSection>

      <FormSection title={t('partner.section.price')}>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('partner.field.originalPrice', { currency })} htmlFor="originalPrice" error={errors.originalPrice}>
            <Input {...field('originalPrice')} type="number" {...moneyInput} placeholder={displayDecimals ? '9' : '900'} />
          </FormField>
          <FormField label={t('partner.field.price', { currency })} htmlFor="price" error={errors.price} hint={t('partner.field.priceHint')}>
            <Input {...field('price')} type="number" {...moneyInput} placeholder={original ? String(Math.round((original / 3) * 10 ** displayDecimals) / 10 ** displayDecimals) : displayDecimals ? '2.99' : '299'} />
          </FormField>
          <FormField
            label={t('partner.field.quantity')}
            htmlFor="quantity"
            error={errors.quantity}
            hint={reserved ? t('partner.reservedOf', { reserved, total: editing!.quantityTotal }) : undefined}
          >
            <Input {...field('quantity')} type="number" inputMode="numeric" min={Math.max(1, reserved)} />
          </FormField>
          <FormField label={t('partner.field.maxPer')} htmlFor="maxPer" hint={t('partner.field.maxPerHint')} error={errors.maxPer}>
            <Input {...field('maxPer')} type="number" inputMode="numeric" min={1} max={20} />
          </FormField>
        </div>
        {suggestion.data?.suggestedQuantity != null && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 p-3 text-sm">
            <p>
              <span className="flex items-center gap-1.5 font-semibold text-secondary-foreground">
                <Sparkles className="size-4" />
                {t('suggest.title')}
              </span>
              {t('suggest.text', {
                count: suggestion.data.suggestedQuantity,
                weeks: suggestion.data.basedOnWeeks,
                rate: suggestion.data.sellThrough ?? 0,
              })}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => set('quantity', String(suggestion.data!.suggestedQuantity))}>
              {t('suggest.use')}
            </Button>
          </div>
        )}
        {showPreview && (
          <p className="rounded-xl bg-success/10 p-3 text-sm font-semibold text-success">
            {t('partner.pricePreview', {
              price: formatMoney(price * minorUnits, currency),
              original: formatMoney(original * minorUnits, currency),
              percent: discountPercent(original, price),
            })}
          </p>
        )}
      </FormSection>

      <FormSection title={t('partner.section.time')}>
        <FormField label={t('partner.field.date')} htmlFor="date" error={errors.date}>
          <div className="flex flex-wrap gap-2">
            {dateChoices.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-pressed={form.date === c.value}
                onClick={() => set('date', c.value)}
                className={cn(
                  'h-11 rounded-full border px-5 text-sm font-semibold transition-colors',
                  form.date === c.value ? 'border-primary bg-secondary text-primary' : 'bg-card hover:bg-muted',
                )}
              >
                {c.label}
              </button>
            ))}
            <Input {...field('date')} type="date" min={today()} className="w-auto flex-1" />
          </div>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('partner.field.from')} htmlFor="from">
            <Input {...field('from')} type="time" step={900} />
          </FormField>
          <FormField label={t('partner.field.to')} htmlFor="to" error={errors.to}>
            <Input {...field('to')} type="time" step={900} />
          </FormField>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input type="checkbox" checked={form.dropOn} onChange={(e) => set('dropOn', e.target.checked)} className="size-5 accent-[var(--primary)]" />
          {t('partner.field.priceDrop')}
        </label>
        {form.dropOn && (
          <div className="space-y-2 rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">{t('partner.field.priceDropHint')}</p>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('partner.field.priceDropAt')} htmlFor="dropTime">
                <Input {...field('dropTime')} type="time" step={900} />
              </FormField>
              <FormField label={t('partner.field.priceDropPrice', { currency })} htmlFor="dropPrice" error={errors.dropPrice}>
                <Input {...field('dropPrice')} type="number" {...moneyInput} placeholder={price ? String(Math.round(price * 0.7 * 10 ** displayDecimals) / 10 ** displayDecimals) : ''} />
              </FormField>
            </div>
          </div>
        )}
      </FormSection>

      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error instanceof ApiError ? error.message : t('common.errorText')}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" asChild>
          <Link to="/business">{t('partner.cancel')}</Link>
        </Button>
        <Button type="submit" className="flex-1" disabled={save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />}
          {t('partner.save')}
        </Button>
      </div>

      {editing && (
        <Card className="space-y-3 p-5">
          {editing.status !== 'expired' && (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={save.isPending}
              onClick={() => save.mutate({ id: editing.id, body: { status: editing.status === 'paused' ? 'active' : 'paused' } }, { onSuccess: () => navigate('/business') })}
            >
              {editing.status === 'paused' ? <Play /> : <Pause />}
              {editing.status === 'paused' ? t('partner.activate') : t('partner.pause')}
            </Button>
          )}
          {confirmDelete ? (
            <div className="space-y-2 text-center">
              <p className="text-sm font-semibold">{t('partner.deleteConfirm')}</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>
                  {t('reservations.cancelNo')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(editing.id, { onSuccess: () => navigate('/business'), onSettled: () => setConfirmDelete(false) })}
                >
                  {remove.isPending && <Loader2 className="animate-spin" />}
                  {t('partner.deleteYes')}
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="ghost" className="w-full text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
              <Trash2 />
              {t('partner.delete')}
            </Button>
          )}
        </Card>
      )}
    </form>
  )
}

function OfferFormLoader() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const copyId = params.get('copy')
  const businesses = useMyBusinesses()
  const source = useOffer(id ?? copyId ?? undefined)

  if (businesses.isLoading || source.isLoading) return <Skeleton className="mx-auto h-96 max-w-2xl rounded-2xl" />
  if (businesses.isError || source.isError) return (
      <ErrorState
        onRetry={() => {
          void businesses.refetch()
          void source.refetch()
        }}
      />
    )
  const mine = businesses.data?.data ?? []
  if (!mine.length)
    return (
      <EmptyState
        icon={Store}
        title={t('business.empty')}
        action={
          <Button asChild>
            <Link to="/business/locations/new">{t('partner.addFirstLocation')}</Link>
          </Button>
        }
      />
    )

  const mode: Mode = id && source.data ? { kind: 'edit', offer: source.data } : copyId && source.data ? { kind: 'copy', source: source.data } : { kind: 'new' }
  return <OfferForm key={`${mode.kind}-${source.data?.id ?? 'new'}`} mode={mode} businesses={mine} preferredBusinessId={params.get('businessId')} />
}

export function OfferFormPage() {
  const { id } = useParams()
  return (
    <div>
      <Button asChild variant="ghost" className="mb-3 -ml-3">
        <Link to="/business">
          <ArrowLeft />
          {t('business.title')}
        </Link>
      </Button>
      <PageHeader title={id ? t('partner.editOffer') : t('partner.addOffer')} />
      <PartnerGuard>
        {/* Editing existing offers stays possible; new ones wait for the partner rules. */}
        {id ? <OfferFormLoader /> : <PartnerTermsGate><OfferFormLoader /></PartnerTermsGate>}
      </PartnerGuard>
    </div>
  )
}
