import { Link } from 'react-router'
import { Clock, MapPin, Star } from 'lucide-react'
import type { Offer } from '@/api/types'
import { SafeImage } from '@/components/common/SafeImage'
import { Badge } from '@/components/ui/badge'
import { t } from '@/i18n'
import { formatDistance, formatPickupWindow, formatRating } from '@/lib/format'
import { cn } from '@/lib/utils'
import { FavoriteButton } from './FavoriteButton'
import { Price } from './Price'

export function OfferCard({ offer, className }: { offer: Offer; className?: string }) {
  const soldOut = offer.quantityAvailable === 0
  const distance = formatDistance(offer.distanceMeters)

  return (
    <Link
      to={`/offers/${offer.id}`}
      className={cn(
        'group block overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        className,
      )}
    >
      <div className="relative h-36 sm:h-40">
        <SafeImage
          src={offer.imageUrl}
          alt=""
          className={cn('size-full transition-transform duration-500 group-hover:scale-105', soldOut && 'grayscale-[60%]')}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute top-3 left-3">
          {soldOut ? (
            <Badge variant="glass">{t('offer.soldOut')}</Badge>
          ) : (
            <Badge variant="accent">{t('offer.left', { count: offer.quantityAvailable })}</Badge>
          )}
        </div>
        <FavoriteButton targetType="business" targetId={offer.businessId} className="absolute top-2.5 right-2.5" />
        <div className="absolute right-3 bottom-3 left-3 flex items-center gap-2.5">
          <SafeImage src={offer.business.logoUrl} alt="" className="size-10 shrink-0 rounded-full border-2 border-white" />
          <span className="truncate text-base font-bold text-white drop-shadow">{offer.business.name}</span>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1.5">
          <p className="truncate font-semibold">{offer.title}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            <span className="truncate">{formatPickupWindow(offer.pickupStart, offer.pickupEnd, offer.timezone)}</span>
          </p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Star className="size-3.5 shrink-0 fill-warning text-warning" />
            <span className="font-semibold text-foreground">{formatRating(offer.business.rating)}</span>
            {distance && (
              <>
                <span aria-hidden>·</span>
                <MapPin className="size-3.5 shrink-0" />
                {distance}
              </>
            )}
          </p>
        </div>
        <Price priceMinor={offer.priceMinor} originalPriceMinor={offer.originalPriceMinor} currency={offer.currency} />
      </div>
    </Link>
  )
}
