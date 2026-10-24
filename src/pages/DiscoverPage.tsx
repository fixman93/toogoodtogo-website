import heroBanner from '@/assets/images/web/hero.webp'
import heroMobile from '@/assets/images/web/hero-mobile.webp'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Leaf, Map as MapIcon, Search } from 'lucide-react'
import { CategoryChips } from '@/components/offers/CategoryChips'
import { OfferCarousel } from '@/components/offers/OfferCarousel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { market } from '@/config/markets'
import { useLocation } from '@/features/location/location-context'
import { NewPartners } from '@/components/offers/NewPartners'
import { PartnerTeaser } from '@/features/partner-pitch/PartnerTeaser'
import { useOffers } from '@/hooks/api'
import { t } from '@/i18n'

const NEARBY_RADIUS_KM = 15

export function DiscoverPage() {
  const navigate = useNavigate()
  const { location, isDeviceLocation } = useLocation()
  const city = market.cities.find((c) => c.id === location.source)
  const nearbyTitle = isDeviceLocation || !city ? t('discover.nearby') : t('discover.inCity', { city: city.locative })
  const [search, setSearch] = useState('')
  const origin = { lat: location.lat, lng: location.lng }

  const nearby = useOffers({ ...origin, maxDistanceKm: NEARBY_RADIUS_KM, sort: 'distance', limit: 10 })
  const popular = useOffers({ ...origin, maxDistanceKm: NEARBY_RADIUS_KM, sort: 'popularity', limit: 10 })
  const soon = useOffers({ ...origin, maxDistanceKm: NEARBY_RADIUS_KM, sort: 'pickup', pickupDay: 'today', limit: 10 })

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl bg-primary text-primary-foreground">
        {/* Brand banner: the bag with groceries on phones, the full banner from 640 px. */}
        <picture>
          <source media="(min-width: 640px)" srcSet={heroBanner} />
          <img src={heroMobile} alt={t('discover.heroAlt')} width={763} height={481} className="block h-auto w-full bg-[#f6efe2]" />
        </picture>
        <div className="relative overflow-hidden px-5 py-6 sm:px-10 sm:py-8">
        <div className="absolute -top-16 -right-16 size-56 rounded-full bg-accent/25 blur-2xl" aria-hidden />
        <div className="absolute -bottom-24 left-1/3 size-56 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="relative max-w-xl">
          <h1 className="text-[26px] leading-tight font-extrabold tracking-tight sm:text-4xl">{t('discover.heroTitle')}</h1>
          <p className="mt-2 text-sm text-primary-foreground/80 sm:text-base">{t('discover.heroText')}</p>
          <form
            role="search"
            className="relative mt-5"
            onSubmit={(e) => {
              e.preventDefault()
              navigate(`/browse${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`)
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('discover.searchPlaceholder')}
              aria-label={t('discover.searchPlaceholder')}
              className="h-13 rounded-full border-0 pl-12 text-foreground shadow-lg"
            />
          </form>
        </div>
        </div>
      </section>

      <CategoryChips value={undefined} onChange={(category) => navigate(category ? `/browse?category=${category}` : '/browse')} />

      <Button asChild variant="secondary" size="lg" className="w-full sm:w-auto">
        <Link to="/browse?view=map">
          <MapIcon />
          {t('map.showOnMap')}
        </Link>
      </Button>

      <OfferCarousel
        title={nearbyTitle}
        offers={nearby.data?.data}
        isLoading={nearby.isLoading}
        isError={nearby.isError}
        onRetry={nearby.refetch}
        seeAllTo="/browse?sort=distance"
      />

      <section className="flex items-start gap-4 rounded-2xl bg-secondary p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Leaf className="size-5" />
        </span>
        <div>
          <h2 className="font-bold text-secondary-foreground">{t('discover.impactTitle')}</h2>
          <p className="mt-0.5 text-sm text-secondary-foreground/80">{t('discover.impactText')}</p>
        </div>
      </section>

      <NewPartners />

      <PartnerTeaser />

      <OfferCarousel
        title={t('discover.popular')}
        offers={popular.data?.data}
        isLoading={popular.isLoading}
        isError={popular.isError}
        onRetry={popular.refetch}
        seeAllTo="/browse?sort=popularity"
      />

      <OfferCarousel
        title={t('discover.endingSoon')}
        offers={soon.data?.data}
        isLoading={soon.isLoading}
        isError={soon.isError}
        onRetry={soon.refetch}
        seeAllTo="/browse?sort=pickup&pickupDay=today"
      />
    </div>
  )
}
