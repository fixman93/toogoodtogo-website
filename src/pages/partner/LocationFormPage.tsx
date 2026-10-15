import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Loader2, LocateFixed, MapPin, Search } from 'lucide-react'
import { ApiError } from '@/api/client'
import { CATEGORIES, type Business, type BusinessInput, type Category, type GeoPoint } from '@/api/types'
import { FormField, FormSection } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { SafeImage } from '@/components/common/SafeImage'
import { ErrorState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { market } from '@/config/markets'
import { PartnerGuard } from '@/features/business/PartnerGuard'
import { useBusiness, useSaveBusiness } from '@/hooks/api'
import { t } from '@/i18n'
import { geocodeAddress } from '@/lib/geocode'
import { osmEmbedUrl } from '@/lib/geo'

interface FormState {
  name: string
  category: Category
  description: string
  phone: string
  street: string
  city: string
  postalCode: string
  collectionInstructions: string
  logoUrl: string
  coverUrl: string
  isActive: boolean
  location: GeoPoint | null
}

const isUrl = (value: string) => !value || /^https?:\/\/\S+$/i.test(value)

function initialState(business?: Business): FormState {
  return {
    name: business?.name ?? '',
    category: business?.category ?? 'bakery',
    description: business?.description ?? '',
    phone: business?.phone ?? '',
    street: business?.address.street ?? '',
    city: business?.address.city ?? market.cities[0].name,
    postalCode: business?.address.postalCode ?? '',
    collectionInstructions: business?.collectionInstructions ?? 'Pokaži kod za preuzimanje na kasi.',
    logoUrl: business?.logoUrl ?? '',
    coverUrl: business?.coverUrl ?? '',
    isActive: business?.isActive ?? true,
    location: business?.location ?? null,
  }
}

function LocationForm({ business }: { business?: Business }) {
  const navigate = useNavigate()
  const save = useSaveBusiness()
  const [form, setForm] = useState<FormState>(() => initialState(business))
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [locating, setLocating] = useState<'address' | 'gps' | null>(null)
  const [locateError, setLocateError] = useState<string | null>(null)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    // A field's error disappears as soon as the user edits it.
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))
  }
  const text = (key: 'name' | 'description' | 'phone' | 'street' | 'city' | 'postalCode' | 'collectionInstructions' | 'logoUrl' | 'coverUrl') => ({
    id: key,
    value: form[key],
    'aria-invalid': !!errors[key] || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(key, e.target.value),
  })

  const findAddress = async () => {
    setLocating('address')
    setLocateError(null)
    try {
      const point = await geocodeAddress({ street: form.street, city: form.city, postalCode: form.postalCode }, market.code)
      if (point) set('location', point)
      else setLocateError(t('partner.field.addressNotFound'))
    } catch {
      setLocateError(t('partner.field.addressNotFound'))
    } finally {
      setLocating(null)
    }
  }

  const useGps = () => {
    if (!('geolocation' in navigator)) return setLocateError(t('location.denied'))
    setLocating('gps')
    setLocateError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('location', { lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(null)
      },
      () => {
        setLocateError(t('location.denied'))
        setLocating(null)
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    )
  }

  const validate = () => {
    const next: typeof errors = {}
    if (form.name.trim().length < 2) next.name = t('partner.error.required')
    if (form.street.trim().length < 2) next.street = t('partner.error.required')
    if (form.city.trim().length < 2) next.city = t('partner.error.required')
    if (!form.location) next.location = t('partner.field.locationMissing')
    if (!isUrl(form.logoUrl)) next.logoUrl = t('partner.error.url')
    if (!isUrl(form.coverUrl)) next.coverUrl = t('partner.error.url')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const body: BusinessInput = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: { street: form.street.trim(), city: form.city.trim(), postalCode: form.postalCode.trim() || undefined, countryCode: market.code },
      location: form.location!,
      collectionInstructions: form.collectionInstructions.trim() || undefined,
      logoUrl: form.logoUrl.trim(),
      coverUrl: form.coverUrl.trim(),
      ...(business ? { isActive: form.isActive } : {}),
    }
    save.mutate({ id: business?.id, body }, { onSuccess: () => navigate('/business') })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-2xl space-y-5">
      <FormSection title={t('partner.section.basic')}>
        <FormField label={t('partner.field.name')} htmlFor="name" error={errors.name}>
          <Input {...text('name')} placeholder="Pekara Klas – Vračar" maxLength={120} />
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
          <FormField label={t('partner.field.phone')} htmlFor="phone">
            <Input {...text('phone')} type="tel" inputMode="tel" placeholder="+381 11 123 4567" />
          </FormField>
        </div>
        <FormField label={t('partner.field.description')} htmlFor="description">
          <Textarea {...text('description')} maxLength={2000} placeholder="Porodična pekara sa hlebom na kiselom testu…" />
        </FormField>
        {business && (
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="size-5 accent-[var(--primary)]" />
            {t('partner.field.isActive')}
          </label>
        )}
      </FormSection>

      <FormSection title={t('partner.section.address')}>
        <FormField label={t('partner.field.street')} htmlFor="street" error={errors.street}>
          <Input {...text('street')} autoComplete="street-address" placeholder="Cara Dušana 45" />
        </FormField>
        <div className="grid grid-cols-[1fr_8rem] gap-4">
          <FormField label={t('partner.field.city')} htmlFor="city" error={errors.city}>
            <Input {...text('city')} list="market-cities" autoComplete="address-level2" />
            <datalist id="market-cities">
              {market.cities.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </FormField>
          <FormField label={t('partner.field.postalCode')} htmlFor="postalCode">
            <Input {...text('postalCode')} inputMode="numeric" autoComplete="postal-code" placeholder="11000" />
          </FormField>
        </div>

        <FormField label={t('partner.field.location')} hint={t('partner.field.locationHint')} error={errors.location ?? locateError ?? undefined}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="secondary" className="flex-1" disabled={!!locating || !form.street || !form.city} onClick={findAddress}>
              {locating === 'address' ? <Loader2 className="animate-spin" /> : <Search />}
              {t('partner.field.findOnMap')}
            </Button>
            <Button type="button" variant="outline" className="flex-1" disabled={!!locating} onClick={useGps}>
              {locating === 'gps' ? <Loader2 className="animate-spin" /> : <LocateFixed />}
              {t('partner.field.useGps')}
            </Button>
          </div>
          {form.location && (
            <div className="overflow-hidden rounded-xl border">
              <iframe title={t('partner.field.location')} src={osmEmbedUrl(form.location, 0.004)} className="h-52 w-full" loading="lazy" />
              <p className="flex items-center gap-1.5 bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <MapPin className="size-3.5" />
                {form.location.lat.toFixed(5)}, {form.location.lng.toFixed(5)}
              </p>
            </div>
          )}
        </FormField>
      </FormSection>

      <FormSection title={t('partner.section.pickup')}>
        <FormField label={t('partner.field.instructions')} htmlFor="collectionInstructions" hint={t('partner.field.instructionsHint')}>
          <Textarea {...text('collectionInstructions')} maxLength={1000} className="min-h-20" />
        </FormField>
      </FormSection>

      <FormSection title={t('partner.section.images')}>
        <p className="text-xs text-muted-foreground">{t('partner.field.imagesHint')}</p>
        <FormField label={t('partner.field.coverUrl')} htmlFor="coverUrl" error={errors.coverUrl}>
          <Input {...text('coverUrl')} type="url" inputMode="url" placeholder="https://…" />
        </FormField>
        <FormField label={t('partner.field.logoUrl')} htmlFor="logoUrl" error={errors.logoUrl}>
          <Input {...text('logoUrl')} type="url" inputMode="url" placeholder="https://…" />
        </FormField>
        {(form.coverUrl || form.logoUrl) && (
          <div className="relative h-36 overflow-hidden rounded-xl">
            <SafeImage src={isUrl(form.coverUrl) ? form.coverUrl : undefined} alt="" className="size-full" />
            <SafeImage
              src={isUrl(form.logoUrl) ? form.logoUrl : undefined}
              alt=""
              className="absolute bottom-3 left-3 size-14 rounded-full border-2 border-white"
            />
          </div>
        )}
      </FormSection>

      {save.isError && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {save.error instanceof ApiError ? save.error.message : t('common.errorText')}
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
    </form>
  )
}

function EditLocation({ id }: { id: string }) {
  const { data, isLoading, isError, refetch } = useBusiness(id)
  if (isLoading) return <Skeleton className="mx-auto h-96 max-w-2xl rounded-2xl" />
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />
  return <LocationForm key={data.id} business={data} />
}

export function LocationFormPage() {
  const { id } = useParams()
  return (
    <div>
      <Button asChild variant="ghost" className="mb-3 -ml-3">
        <Link to="/business">
          <ArrowLeft />
          {t('business.title')}
        </Link>
      </Button>
      <PageHeader title={id ? t('partner.editLocation') : t('partner.addLocation')} />
      <PartnerGuard>{id ? <EditLocation id={id} /> : <LocationForm />}</PartnerGuard>
    </div>
  )
}
