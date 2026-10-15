import { Link } from 'react-router'
import { Heart, MapPin, Star } from 'lucide-react'
import type { Favorite } from '@/api/types'
import { PageHeader } from '@/components/common/PageHeader'
import { RequireAuth } from '@/components/common/RequireAuth'
import { SafeImage } from '@/components/common/SafeImage'
import { EmptyState, ErrorState, OfferCardSkeleton } from '@/components/common/StateViews'
import { FavoriteButton } from '@/components/offers/FavoriteButton'
import { OfferCard } from '@/components/offers/OfferCard'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useLocation } from '@/features/location/location-context'
import { useFavorites, useOffers } from '@/hooks/api'
import { t } from '@/i18n'
import { formatRating } from '@/lib/format'

function FavoriteBusiness({ favorite }: { favorite: Favorite }) {
  const { location } = useLocation()
  const business = favorite.business!
  const offers = useOffers({ businessId: business.id, lat: location.lat, lng: location.lng })

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        <SafeImage src={business.logoUrl} alt="" className="size-14 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{business.name}</p>
          <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
            <Star className="size-3.5 fill-warning text-warning" />
            {formatRating(business.rating.average)}
            <span aria-hidden>·</span>
            <MapPin className="size-3.5" />
            {business.address.street}, {business.address.city}
          </p>
        </div>
        <FavoriteButton targetType="business" targetId={business.id} className="border" />
      </div>
      <div className="border-t bg-muted/40 p-4">
        {offers.isLoading ? (
          <OfferCardSkeleton className="max-w-sm" />
        ) : offers.data?.data.length ? (
          <div className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4">
            {offers.data.data.map((offer) => (
              <OfferCard key={offer.id} offer={offer} className="w-[78vw] max-w-80 shrink-0" />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('favorites.noActiveOffers')}</p>
        )}
      </div>
    </Card>
  )
}

function FavoritesList() {
  const { data, isLoading, isError, refetch } = useFavorites()
  if (isLoading)
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <OfferCardSkeleton />
        <OfferCardSkeleton />
      </div>
    )
  if (isError) return <ErrorState onRetry={() => refetch()} />

  const businesses = data?.data.filter((f) => f.targetType === 'business' && f.business) ?? []
  const offers = data?.data.filter((f) => f.targetType === 'offer' && f.offer) ?? []

  if (!businesses.length && !offers.length)
    return (
      <EmptyState
        icon={Heart}
        title={t('favorites.emptyTitle')}
        text={t('favorites.emptyText')}
        action={
          <Button asChild>
            <Link to="/browse">{t('nav.browse')}</Link>
          </Button>
        }
      />
    )

  return (
    <div className="space-y-8">
      {businesses.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">{t('favorites.businesses')}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {businesses.map((f) => (
              <FavoriteBusiness key={f.id} favorite={f} />
            ))}
          </div>
        </section>
      )}
      {offers.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">{t('favorites.offers')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {offers.map((f) => (
              <OfferCard key={f.id} offer={f.offer!} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export function FavoritesPage() {
  return (
    <div>
      <PageHeader title={t('favorites.title')} />
      <RequireAuth>
        <FavoritesList />
      </RequireAuth>
    </div>
  )
}
