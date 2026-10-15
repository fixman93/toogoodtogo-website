import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, CalendarClock, ExternalLink, Info, Loader2, MapPin, Minus, PackageOpen, Plus, ShoppingBag, Star } from 'lucide-react'
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
import { useBusiness, useBusinessReviews, useCreateReservation, useOffer } from '@/hooks/api'
import { t } from '@/i18n'
import { discountPercent, formatDate, formatDistance, formatMoney, formatPickupWindow, formatRating } from '@/lib/format'
import { directionsUrl, distanceMeters, osmEmbedUrl } from '@/lib/geo'

function ReservePanel({ offer }: { offer: Offer }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [quantity, setQuantity] = useState(1)
  const reserve = useCreateReservation()
  const max = Math.min(offer.maxPerReservation, offer.quantityAvailable)
  const soldOut = offer.quantityAvailable === 0
  const error = reserve.error instanceof ApiError ? reserve.error.message : reserve.error ? t('common.errorText') : null

  const submit = () => {
    if (!user) return navigate('/login', { state: { from: `/offers/${offer.id}` } })
    reserve.mutate(
      { offerId: offer.id, quantity },
      { onSuccess: (reservation) => navigate(`/reservations/${reservation.id}`, { state: { justReserved: true } }) },
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
      <Button size="lg" className="w-full" disabled={soldOut || reserve.isPending} onClick={submit}>
        {reserve.isPending && <Loader2 className="animate-spin" />}
        {soldOut
          ? t('offer.soldOut')
          : user
            ? t('offer.reserveFor', { price: formatMoney(offer.priceMinor * quantity, offer.currency) })
            : t('offer.loginToReserve')}
      </Button>
      {error && (
        <p role="alert" className="text-center text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <p className="text-center text-xs text-muted-foreground">{t('offer.payAtPickup')}</p>
    </div>
  )
}

function Reviews({ businessId }: { businessId: string }) {
  const { data, isLoading } = useBusinessReviews(businessId)
  if (isLoading) return <Skeleton className="h-24" />
  if (!data?.data.length) return <p className="text-sm text-muted-foreground">{t('offer.noReviews')}</p>
  return (
    <ul className="space-y-4">
      {data.data.map((review) => (
        <li key={review.id} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">{review.user.name}</span>
            <span className="flex items-center gap-0.5" aria-label={`${review.rating}/5`}>
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className={i < review.rating ? 'size-3.5 fill-warning text-warning' : 'size-3.5 text-border'} />
              ))}
            </span>
          </div>
          {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
          <p className="text-xs text-muted-foreground/80">{formatDate(review.createdAt)}</p>
        </li>
      ))}
    </ul>
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
  const address = `${business.address.street}, ${business.address.city}`

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
        <FavoriteButton targetType="business" targetId={business.id} className="absolute top-3 right-3 size-11" />
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
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{business.name}</h1>
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
              <Price priceMinor={offer.priceMinor} originalPriceMinor={offer.originalPriceMinor} currency={offer.currency} size="lg" />
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
              <p className="rounded-xl bg-muted p-3 text-muted-foreground">{t('offer.surpriseNote')}</p>
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

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-5 text-primary" />
                {t('offer.address')}
              </CardTitle>
              <p className="text-sm">{address}</p>
            </CardHeader>
            <iframe
              title={`Mapa – ${business.name}`}
              src={osmEmbedUrl(business.location)}
              loading="lazy"
              className="h-56 w-full border-y"
            />
            <div className="p-4">
              <Button asChild variant="outline" className="w-full">
                <a href={directionsUrl(business.location)} target="_blank" rel="noreferrer">
                  {t('offer.directions')}
                  <ExternalLink />
                </a>
              </Button>
            </div>
          </Card>

          <InstructionsCard businessId={business.id} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="size-5 text-primary" />
                {t('offer.reviews')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Reviews businessId={business.id} />
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
  if (!data?.collectionInstructions) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="size-5 text-primary" />
          {t('offer.instructions')}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm leading-relaxed">{data.collectionInstructions}</CardContent>
    </Card>
  )
}
