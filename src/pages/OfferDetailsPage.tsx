import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { AlertTriangle, ArrowLeft, Bell, BellRing, Clock, CalendarClock, Gift, Info, Loader2, MapPin, Minus, PackageOpen, Plus, ShoppingBag, Star } from 'lucide-react'
import { ApiError } from '@/api/client'
import type { Offer } from '@/api/types'
import { SafeImage } from '@/components/common/SafeImage'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { FavoriteButton } from '@/components/offers/FavoriteButton'
import { Price } from '@/components/offers/Price'
import { CATEGORY_ICONS } from '@/components/offers/categories'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { useLocation } from '@/features/location/location-context'
import { DirectionsCard } from '@/features/map/DirectionsCard'
import { FulfillmentPicker } from '@/features/delivery/FulfillmentPicker'
import { deliveryFee, rememberTarget, type DeliveryTarget } from '@/features/delivery/delivery'
import { PriceDropBadge } from '@/components/offers/PriceDropBadge'
import { ReviewList } from '@/components/offers/ReviewList'
import { BagPhotos } from '@/components/offers/BagPhotos'
import { Input } from '@/components/ui/input'
import { useBusiness, useCheckPromotion, useCreateReservation, useOffer, useToggleWaitlist, useWaitlist } from '@/hooks/api'
import { t } from '@/i18n'
import { discountPercent, formatDistance, formatMoney, formatPickupWindow, formatRating } from '@/lib/format'
import { distanceMeters } from '@/lib/geo'

function ReservePanel({ offer }: { offer: Offer }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [quantity, setQuantity] = useState(1)
  const [promoOpen, setPromoOpen] = useState(false)
  const [promoInput, setPromoInput] = useState('')
  const check = useCheckPromotion()
  const [promo, setPromo] = useState<{ code: string; discountMinor: number; quantity: number } | null>(null)
  // The preview is for a specific quantity; changing it re-checks the code.
  const applied = promo && promo.quantity === quantity ? promo : null
  const applyPromo = (code: string) =>
    check.mutate({ code, offerId: offer.id, quantity }, { onSuccess: (r) => setPromo({ code: r.code, discountMinor: r.discountMinor, quantity }) })
  const reserve = useCreateReservation()
  const delivery = offer.business.delivery?.enabled ? offer.business.delivery : null
  const [mode, setMode] = useState<'pickup' | 'delivery'>('pickup')
  const [target, setTarget] = useState<DeliveryTarget | null>(null)
  // Invited by a friend: the first bag is discounted by the platform (same rule as the server: at least 1 unit left to pay).
  const welcome = !applied && user?.welcomeDiscountPercent ? user.welcomeDiscountPercent : null
  const gross = offer.priceMinor * quantity
  const welcomeMinor = welcome ? Math.max(0, Math.min(Math.round((gross * welcome) / 100), gross - 100)) : 0
  const subtotal = gross - (applied?.discountMinor ?? 0) - welcomeMinor
  const fee = delivery && mode === 'delivery' ? deliveryFee(delivery, subtotal) : 0
  const needsAddress = mode === 'delivery' && !target
  // The limit is per customer: bags from earlier reservations of this offer count too.
  const held = offer.myQuantity ?? 0
  const left = Math.max(0, offer.maxPerReservation - held)
  const max = Math.min(left, offer.quantityAvailable)
  const soldOut = offer.quantityAvailable === 0
  const limitReached = !!user && !soldOut && left === 0
  const showLimit = !soldOut && (held > 0 || offer.maxPerReservation < offer.quantityAvailable)
  const error = reserve.error instanceof ApiError ? reserve.error.message : reserve.error ? t('common.errorText') : null

  const submit = () => {
    if (!user) return navigate('/login', { state: { from: `/offers/${offer.id}` } })
    if (needsAddress) return
    reserve.mutate(
      {
        offerId: offer.id,
        quantity,
        promoCode: applied?.code,
        ...(mode === 'delivery' && target
          ? { fulfillment: 'delivery' as const, delivery: { address: target.address, lat: target.point.lat, lng: target.point.lng, note: target.note || undefined } }
          : {}),
      },
      {
        onSuccess: (reservation) => {
          if (mode === 'delivery' && target) rememberTarget(target)
          navigate(`/reservations/${reservation.id}`, { state: { justReserved: true } })
        },
      },
    )
  }

  return (
    <div className="space-y-3">
      {!soldOut && max > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t('offer.quantity')}</span>
          <div className="flex items-center gap-1 rounded-full border bg-card p-1">
            <Button variant="ghost" size="icon" className="size-9" aria-label="-" disabled={quantity <= 1} onClick={() => setQuantity((q) => q - 1)}>
              <Minus />
            </Button>
            <span className="w-8 text-center font-bold tabular-nums" aria-live="polite">
              {quantity}
            </span>
            <Button variant="ghost" size="icon" className="size-9" aria-label="+" disabled={quantity >= max} onClick={() => setQuantity((q) => q + 1)}>
              <Plus />
            </Button>
          </div>
        </div>
      )}
      {showLimit && (
        <p className="text-center text-xs font-medium text-muted-foreground">
          {t('offer.perCustomer', { count: offer.maxPerReservation })}
          {held > 0 && ` · ${t('offer.alreadyHeld', { count: held })}`}
        </p>
      )}
      {soldOut && <WaitlistButton offerId={offer.id} />}
      {delivery && !soldOut && !limitReached && (
        <FulfillmentPicker
          business={offer.business}
          delivery={delivery}
          currency={offer.currency}
          subtotalMinor={subtotal}
          mode={mode}
          onModeChange={setMode}
          target={target}
          onTargetChange={setTarget}
        />
      )}
      <Button size="lg" className="w-full" disabled={soldOut || limitReached || reserve.isPending || (!!user && needsAddress)} onClick={submit}>
        {reserve.isPending && <Loader2 className="animate-spin" />}
        {soldOut
          ? t('offer.soldOut')
          : limitReached
            ? t('offer.limitReached')
            : user
            ? t(mode === 'delivery' ? 'delivery.orderFor' : 'offer.reserveFor', { price: formatMoney(subtotal + fee, offer.currency) })
            : t('offer.loginToReserve')}
      </Button>
      {!soldOut && (
        <p className="flex items-start justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          {t('offer.noGuarantee')}
        </p>
      )}
      {welcomeMinor > 0 && (
        <p className="flex items-center justify-center gap-1.5 text-center text-sm font-semibold text-success">
          <Gift className="size-4" />
          {t('referral.applied', { percent: welcome!, amount: formatMoney(welcomeMinor, offer.currency) })}
        </p>
      )}
      {error && (
        <p role="alert" className="text-center text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {user && !soldOut && (
        <div className="text-center text-sm">
          {applied ? (
            <p className="font-semibold text-success">
              {t('offer.promoApplied', { code: applied.code, amount: formatMoney(applied.discountMinor, offer.currency) })}{' '}
              <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setPromo(null)}>
                {t('offer.promoRemove')}
              </button>
            </p>
          ) : promoOpen ? (
            <div className="flex gap-2">
              <Input value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} placeholder={t('offer.promoPlaceholder')} className="h-10 font-mono uppercase" aria-label={t('offer.promoPlaceholder')} />
              <Button type="button" size="sm" variant="outline" className="h-10" disabled={promoInput.trim().length < 2 || check.isPending} onClick={() => applyPromo(promoInput.trim())}>
                {check.isPending && <Loader2 className="animate-spin" />}
                {t('offer.promoApply')}
              </Button>
            </div>
          ) : (
            <button type="button" className="text-xs font-semibold text-primary underline" onClick={() => setPromoOpen(true)}>
              {t('offer.promoToggle')}
            </button>
          )}
          {promoOpen && !applied && check.isError && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {check.error instanceof ApiError ? check.error.message : t('common.errorText')}
            </p>
          )}
          {promo && !applied && (
            <button type="button" className="mt-1 text-xs text-primary underline" onClick={() => applyPromo(promo.code)}>
              {t('offer.promoApply')} {promo.code}
            </button>
          )}
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">{mode === 'delivery' ? t('delivery.payToCourier') : t('offer.payAtPickup')}</p>
    </div>
  )
}

function DetailsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="-mx-4 h-60 rounded-none sm:mx-0 sm:rounded-3xl" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-32" />
    </div>
  )
}

export function OfferDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { location, isDeviceLocation } = useLocation()
  const { data: offer, isLoading, isError, error, refetch } = useOffer(id)

  if (isLoading) return <DetailsSkeleton />
  if (isError) {
    if (error instanceof ApiError && error.status === 404)
      return (
        <EmptyState
          icon={PackageOpen}
          title={t('offer.notFound')}
          action={
            <Button asChild>
              <Link to="/browse">{t('nav.browse')}</Link>
            </Button>
          }
        />
      )
    return <ErrorState onRetry={() => refetch()} />
  }
  if (!offer) return null

  const { business } = offer
  const CategoryIcon = CATEGORY_ICONS[offer.category]
  const km = formatDistance(distanceMeters(location, business.location))
  const distance = km && !isDeviceLocation ? t('location.fromCenter', { distance: km }) : km

  return (
    <div className="-mt-5 sm:mt-0">
      <div className="relative -mx-4 h-64 sm:mx-0 sm:h-80 sm:overflow-hidden sm:rounded-3xl">
        <SafeImage src={business.coverUrl ?? offer.imageUrl} alt="" className="size-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('common.back')}
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="absolute top-3 left-3 bg-white/90 shadow-sm backdrop-blur hover:bg-white"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <FavoriteButton targetType="offer" targetId={offer.id} className="absolute top-3 right-3 size-11" />
        <div className="absolute bottom-4 left-4 flex items-center gap-3">
          <SafeImage src={business.logoUrl} alt="" className="size-16 rounded-full border-[3px] border-white shadow-lg" />
          <Badge variant={offer.quantityAvailable ? 'accent' : 'glass'}>
            {offer.quantityAvailable ? t('offer.available', { count: offer.quantityAvailable }) : t('offer.soldOut')}
          </Badge>
        </div>
      </div>

      <div className="mt-5 lg:grid lg:grid-cols-[1fr_360px] lg:gap-8">
        <div className="space-y-5">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <CategoryIcon className="size-4" />
              {t(`category.${offer.category}`)}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
              <Link to={`/businesses/${business.id}`} className="hover:underline">
                {business.name}
              </Link>
            </h1>
            <p className="mt-0.5 text-lg font-semibold text-primary">{offer.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="flex items-center gap-1">
                <Star className="size-4 fill-warning text-warning" />
                <strong>{formatRating(business.rating)}</strong>
                {business.rating.count > 0 && (
                  <span className="text-muted-foreground">({t('common.reviews', { count: business.rating.count })})</span>
                )}
              </span>
              {distance && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="size-4" />
                  {distance}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="flex items-center gap-3 p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                <CalendarClock className="size-5 text-primary" />
              </span>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{t('offer.pickup')}</p>
                <p className="font-bold">{formatPickupWindow(offer.pickupStart, offer.pickupEnd, offer.timezone)}</p>
              </div>
            </Card>
            <Card className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{t('offer.originalPrice')}</p>
                <Badge variant="success" className="mt-1">
                  -{discountPercent(offer.originalPriceMinor, offer.priceMinor)}% ·{' '}
                  {t('offer.save', { amount: formatMoney(offer.originalPriceMinor - offer.priceMinor, offer.currency) })}
                </Badge>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Price priceMinor={offer.priceMinor} originalPriceMinor={offer.originalPriceMinor} currency={offer.currency} size="lg" />
                <PriceDropBadge offer={offer} />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="size-5 text-primary" />
                {t('offer.whatYouGet')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed">
              <p>{offer.description}</p>
              {offer.contentType === 'known' && offer.contents.length > 0 ? (
                <div className="rounded-xl bg-secondary/60 p-3">
                  <p className="mb-1.5 font-semibold text-secondary-foreground">{t('offer.knownContents')}</p>
                  <ul className="list-inside list-disc space-y-0.5">
                    {offer.contents.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">{t('offer.knownNote')}</p>
                </div>
              ) : (
                <p className="flex items-start gap-2 rounded-xl bg-muted p-3 font-medium">
                  <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                  {t('offer.surpriseNote')}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{t('offer.responsibility')}</p>
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="size-4 text-accent-foreground" />
                  {t('offer.allergens')}
                </p>
                {offer.allergens.length ? (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {offer.allergens.map((a) => (
                        <Badge key={a} variant="outline">
                          {t(`allergen.${a}`)}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">{t('offer.allergensNote')}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('offer.allergensNone')}</p>
                )}
              </div>
              {offer.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {offer.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag === 'vegetarian' ? 'Vegetarijansko' : tag === 'vegan' ? 'Vegansko' : tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <DirectionsCard name={business.name} address={business.address} point={business.location} />

          <BagPhotos businessId={business.id} />

          <InstructionsCard businessId={business.id} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="size-5 text-primary" />
                {t('offer.reviews')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ReviewList businessId={business.id} />
            </CardContent>
          </Card>
        </div>

        <aside className="hidden lg:block">
          <Card className="sticky top-24 p-5">
            <ReservePanel offer={offer} />
          </Card>
        </aside>
      </div>

      {/* Mobile/tablet sticky reservation bar, sits above the bottom tab bar. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t bg-card/95 p-4 backdrop-blur-lg md:bottom-0 lg:hidden">
        <div className="mx-auto max-w-xl">
          <ReservePanel offer={offer} />
        </div>
      </div>
      <div className="h-44 lg:hidden" aria-hidden />
    </div>
  )
}

function InstructionsCard({ businessId }: { businessId: string }) {
  const { data } = useBusiness(businessId)
  if (!data?.collectionInstructions && !data?.openingHours) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="size-5 text-primary" />
          {t('offer.instructions')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm leading-relaxed">
        {data.collectionInstructions && <p>{data.collectionInstructions}</p>}
        {data.openingHours && (
          <p className="flex items-start gap-2 text-muted-foreground">
            <Clock className="mt-0.5 size-4 shrink-0" />
            {t('offer.openingHours')}: {data.openingHours}
          </p>
        )}
        <Link to={`/businesses/${businessId}`} className="inline-block font-semibold text-primary hover:underline">
          {t('offer.viewBusiness')} →
        </Link>
      </CardContent>
    </Card>
  )
}

/** "Obavesti me" for sold-out offers (signed-in users). */
function WaitlistButton({ offerId }: { offerId: string }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const waitlist = useWaitlist()
  const toggle = useToggleWaitlist()
  const joined = waitlist.data?.includes(offerId) ?? false
  return (
    <div className="space-y-1">
      <Button
        variant={joined ? 'secondary' : 'accent'}
        className="w-full"
        disabled={toggle.isPending}
        onClick={() => (user ? toggle.mutate({ offerId, join: !joined }) : navigate('/login', { state: { from: `/offers/${offerId}` } }))}
      >
        {joined ? <BellRing /> : <Bell />}
        {joined ? t('offer.waitlistJoined') : t('offer.waitlistJoin')}
      </Button>
      {joined && (
        <button type="button" className="w-full text-center text-xs text-muted-foreground underline" onClick={() => toggle.mutate({ offerId, join: false })}>
          {t('offer.waitlistLeave')}
        </button>
      )}
    </div>
  )
}
