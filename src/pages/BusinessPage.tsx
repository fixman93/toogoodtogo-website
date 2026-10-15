import { useNavigate, useParams } from 'react-router'
import { ArrowLeft, Clock, ExternalLink, Info, MapPin, Phone, Star, Store } from 'lucide-react'
import { ApiError } from '@/api/client'
import { SafeImage } from '@/components/common/SafeImage'
import { EmptyState, ErrorState, OfferCardSkeleton } from '@/components/common/StateViews'
import { FavoriteButton } from '@/components/offers/FavoriteButton'
import { OfferCard } from '@/components/offers/OfferCard'
import { ReviewList } from '@/components/offers/ReviewList'
import { CATEGORY_ICONS } from '@/components/offers/categories'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useLocation } from '@/features/location/location-context'
import { useBusiness, useOffers } from '@/hooks/api'
import { t } from '@/i18n'
import { formatRating } from '@/lib/format'
import { directionsUrl, osmEmbedUrl } from '@/lib/geo'

/** Public partner profile: about, hours, address, live offers and reviews. */
export function BusinessPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { location } = useLocation()
  const { data: business, isLoading, isError, error, refetch } = useBusiness(id)
  const offers = useOffers({ businessId: id, lat: location.lat, lng: location.lng, sort: 'pickup', limit: 30 }, { enabled: !!id })

  if (isLoading) return <Skeleton className="h-96 rounded-3xl" />
  if (isError || !business) {
    if (error instanceof ApiError && error.status === 404) return <EmptyState icon={Store} title={t('business.page.notFound')} />
    return <ErrorState onRetry={() => refetch()} />
  }
  const CategoryIcon = CATEGORY_ICONS[business.category]

  return (
    <div className="-mt-5 space-y-5 sm:mt-0">
      <div className="relative -mx-4 h-56 sm:mx-0 sm:h-72 sm:overflow-hidden sm:rounded-3xl">
        <SafeImage src={business.coverUrl} alt="" className="size-full" />
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
        <SafeImage src={business.logoUrl} alt="" className="absolute bottom-4 left-4 size-16 rounded-full border-[3px] border-white shadow-lg" />
      </div>

      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
          <CategoryIcon className="size-4" />
          {t(`category.${business.category}`)}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{business.name}</h1>
        <p className="mt-1 flex items-center gap-1 text-sm">
          <Star className="size-4 fill-warning text-warning" />
          <strong>{formatRating(business.rating)}</strong>
          {business.rating.count > 0 && <span className="text-muted-foreground">({t('common.reviews', { count: business.rating.count })})</span>}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{t('business.page.offers')}</h2>
        {offers.isLoading ? (
          <OfferCardSkeleton className="max-w-80" />
        ) : !offers.data?.data.length ? (
          <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">{t('business.page.noOffers')}</p>
        ) : (
          <div className="scrollbar-none -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {offers.data.data.map((o) => (
              <OfferCard key={o.id} offer={o} className="w-[80vw] max-w-80 shrink-0 snap-start" />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="size-5 text-primary" />
              {t('business.page.about')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            {business.description && <p>{business.description}</p>}
            {business.openingHours && (
              <p className="flex items-start gap-2">
                <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  <strong>{t('offer.openingHours')}:</strong> {business.openingHours}
                </span>
              </p>
            )}
            {business.phone && (
              <p className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" />
                <a href={`tel:${business.phone.replace(/\s/g, '')}`} className="font-medium text-primary">
                  {business.phone}
                </a>
              </p>
            )}
            {business.collectionInstructions && <p className="rounded-xl bg-muted p-3">{business.collectionInstructions}</p>}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="size-5 text-primary" />
              {t('offer.address')}
            </CardTitle>
            <p className="text-sm">
              {business.address.street}, {business.address.city}
            </p>
          </CardHeader>
          <iframe title={`Mapa – ${business.name}`} src={osmEmbedUrl(business.location)} loading="lazy" className="h-48 w-full border-y" />
          <div className="p-4">
            <Button asChild variant="outline" className="w-full">
              <a href={directionsUrl(business.location)} target="_blank" rel="noreferrer">
                {t('offer.directions')}
                <ExternalLink />
              </a>
            </Button>
          </div>
        </Card>
      </div>

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
  )
}
