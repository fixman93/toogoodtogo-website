import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CheckCircle2, Clock, Loader2, MapPin, QrCode, Star, X } from 'lucide-react'
import { ApiError } from '@/api/client'
import type { Offer, OfferLocation, Reservation } from '@/api/types'
import { SafeImage } from '@/components/common/SafeImage'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { useCreateReservation } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDistance, formatMoney, formatPickupWindow, formatRating } from '@/lib/format'

/** One offer with a one-tap "Rezerviši" (1 bag; quantity and promo codes on the offer page). */
function OfferRow({ offer }: { offer: Offer }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const reserve = useCreateReservation()
  const [done, setDone] = useState<Reservation | null>(null)
  const soldOut = offer.quantityAvailable === 0

  if (done) {
    return (
      <li className="flex items-center gap-3 rounded-xl bg-success/12 p-3">
        <CheckCircle2 className="size-6 shrink-0 text-success" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-success">{t('mapCard.reserved')}</p>
          <p className="text-sm">
            {t('mapCard.code')} <span className="font-mono font-bold">{done.code}</span> · {formatMoney(done.totalMinor, done.currency)}
          </p>
        </div>
        <Button asChild size="sm">
          <Link to={`/reservations/${done.id}`}>
            <QrCode />
            {t('mapCard.showQr')}
          </Link>
        </Button>
      </li>
    )
  }

  return (
    <li className="space-y-2 rounded-xl border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/offers/${offer.id}`} className="min-w-0 hover:underline">
          <p className="truncate font-semibold">{offer.title}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            {formatPickupWindow(offer.pickupStart, offer.pickupEnd, offer.timezone)}
            {!soldOut && ` · ${t('offer.available', { count: offer.quantityAvailable })}`}
          </p>
        </Link>
        <span className="shrink-0 text-right">
          <span className="block font-extrabold tabular-nums">{formatMoney(offer.priceMinor, offer.currency)}</span>
          <span className="text-xs text-muted-foreground line-through tabular-nums">{formatMoney(offer.originalPriceMinor, offer.currency)}</span>
        </span>
      </div>
      <Button
        size="sm"
        className="w-full"
        variant={soldOut ? 'secondary' : 'default'}
        disabled={soldOut || reserve.isPending}
        onClick={() => {
          if (!user) return navigate('/login', { state: { from: `/offers/${offer.id}` } })
          reserve.mutate({ offerId: offer.id, quantity: 1 }, { onSuccess: setDone })
        }}
      >
        {reserve.isPending && <Loader2 className="animate-spin" />}
        {soldOut ? t('offer.soldOut') : t('mapCard.reserve', { price: formatMoney(offer.priceMinor, offer.currency) })}
      </Button>
      {reserve.isError && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {reserve.error instanceof ApiError ? reserve.error.message : t('common.errorText')}
        </p>
      )}
    </li>
  )
}

/**
 * Card over the map for the tapped location: who/where, its offers today and
 * the next days, and a one-tap reservation per offer.
 */
export function MapLocationCard({
  location,
  offers,
  isLoading,
  onClose,
}: {
  location?: OfferLocation
  offers: Offer[]
  isLoading: boolean
  onClose: () => void
}) {
  const business = offers[0]?.business
  const name = business?.name ?? location?.name ?? '…'
  const distance = formatDistance(offers[0]?.distanceMeters)
  return (
    <div
      role="dialog"
      aria-label={name}
      className="zl-card-in absolute inset-x-2 bottom-2 z-[5] flex max-h-[62%] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:right-auto sm:left-3 sm:w-[380px] lg:bottom-3"
    >
      <div className="flex items-start gap-3 border-b bg-card p-3">
        <SafeImage src={business?.logoUrl} alt="" className="size-12 shrink-0 rounded-full border" />
        <div className="min-w-0 flex-1">
          <Link to={`/businesses/${business?.id ?? location?.businessId}`} className="block truncate font-bold hover:underline">
            {name}
          </Link>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {business && business.rating.count > 0 && (
              <span className="flex items-center gap-0.5">
                <Star className="size-3.5 fill-warning text-warning" />
                {formatRating(business.rating)}
              </span>
            )}
            {distance && <span>{distance}</span>}
          </p>
          {business && (
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              {business.address.street}, {business.address.city}
            </p>
          )}
        </div>
        <Button size="icon" variant="ghost" className="-mt-1 -mr-1 shrink-0" aria-label={t('common.close')} onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="overflow-y-auto p-2">
        {isLoading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : offers.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{t('favorites.noActiveOffers')}</p>
        ) : (
          <ul className="space-y-2">
            {offers.map((o) => (
              <OfferRow key={o.id} offer={o} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
