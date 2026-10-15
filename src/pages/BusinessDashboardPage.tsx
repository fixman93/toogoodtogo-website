import { useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown, Clock, Copy, MapPin, Pause, Pencil, Play, Plus, ScanLine, Store } from 'lucide-react'
import { isMockMode } from '@/api/client'
import type { Business, Offer } from '@/api/types'
import { PageHeader } from '@/components/common/PageHeader'
import { SafeImage } from '@/components/common/SafeImage'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PartnerGuard } from '@/features/business/PartnerGuard'
import { useBusinessOffers, useMyBusinesses, useSaveOffer } from '@/hooks/api'
import { t } from '@/i18n'
import { formatMoney, formatPickupWindow } from '@/lib/format'
import { cn } from '@/lib/utils'

const isPast = (o: Offer) => o.status === 'expired' || new Date(o.pickupEnd).getTime() <= Date.now()

function OfferStatus({ offer }: { offer: Offer }) {
  if (isPast(offer)) return <Badge variant="muted">{t('partner.status.expired')}</Badge>
  if (offer.status === 'paused') return <Badge variant="accent">{t('partner.status.paused')}</Badge>
  if (offer.quantityAvailable === 0) return <Badge variant="destructive">{t('partner.status.soldOut')}</Badge>
  return <Badge variant="success">{t('partner.status.active')}</Badge>
}

function OfferRow({ offer }: { offer: Offer }) {
  const save = useSaveOffer()
  const past = isPast(offer)
  const reserved = offer.quantityTotal - offer.quantityAvailable
  return (
    <li className={cn('space-y-2.5 px-4 py-3.5', past && 'opacity-75')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{offer.title}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            {formatPickupWindow(offer.pickupStart, offer.pickupEnd, offer.timezone)}
          </p>
        </div>
        <OfferStatus offer={offer} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span>
          <span className="font-bold">{formatMoney(offer.priceMinor, offer.currency)}</span>{' '}
          <span className="text-muted-foreground line-through">{formatMoney(offer.originalPriceMinor, offer.currency)}</span>
        </span>
        <span className="text-muted-foreground">
          {t('partner.reservedOf', { reserved, total: offer.quantityTotal })}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {!past && (
          <Button asChild size="sm" variant="outline">
            <Link to={`/business/offers/${offer.id}/edit`}>
              <Pencil />
              {t('partner.edit')}
            </Link>
          </Button>
        )}
        {!past && (
          <Button
            size="sm"
            variant="outline"
            disabled={save.isPending}
            onClick={() => save.mutate({ id: offer.id, body: { status: offer.status === 'paused' ? 'active' : 'paused' } })}
          >
            {offer.status === 'paused' ? <Play /> : <Pause />}
            {offer.status === 'paused' ? t('partner.activate') : t('partner.pause')}
          </Button>
        )}
        <Button asChild size="sm" variant={past ? 'secondary' : 'ghost'}>
          <Link to={`/business/offers/new?copy=${offer.id}`}>
            <Copy />
            {t('partner.repeatOffer')}
          </Link>
        </Button>
      </div>
    </li>
  )
}

function LocationCard({ business }: { business: Business }) {
  const { data, isLoading } = useBusinessOffers(business.id)
  const [showPast, setShowPast] = useState(false)
  const offers = data?.data ?? []
  const current = offers.filter((o) => !isPast(o)).sort((a, b) => a.pickupStart.localeCompare(b.pickupStart))
  const past = offers.filter(isPast)

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b p-4">
        <SafeImage src={business.logoUrl} alt="" className="size-12 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{business.name}</p>
          <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            {business.address.street}, {business.address.city}
          </p>
        </div>
        <Badge variant={business.isActive ? 'success' : 'muted'}>
          {business.isActive ? t('partner.locationActive') : t('partner.locationInactive')}
        </Badge>
      </div>

      <div className="flex gap-2 border-b bg-muted/30 px-4 py-3">
        <Button asChild size="sm" className="flex-1 sm:flex-none">
          <Link to={`/business/offers/new?businessId=${business.id}`}>
            <Plus />
            {t('partner.addOffer')}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="flex-1 sm:flex-none">
          <Link to={`/business/locations/${business.id}/edit`}>
            <Pencil />
            {t('partner.editLocation')}
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="m-4 h-16" />
      ) : offers.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t('partner.noOffers')}</p>
      ) : (
        <>
          {current.length > 0 && (
            <ul className="divide-y" aria-label={t('partner.currentOffers')}>
              {current.map((o) => (
                <OfferRow key={o.id} offer={o} />
              ))}
            </ul>
          )}
          {past.length > 0 && (
            <div className="border-t">
              <button
                type="button"
                aria-expanded={showPast}
                onClick={() => setShowPast((v) => !v)}
                className="flex min-h-11 w-full items-center justify-between px-4 text-sm font-semibold text-muted-foreground hover:bg-muted/50"
              >
                {t('partner.pastOffers')} ({past.length})
                <ChevronDown className={cn('size-4 transition-transform', showPast && 'rotate-180')} />
              </button>
              {showPast && (
                <ul className="divide-y border-t">
                  {past.slice(0, 10).map((o) => (
                    <OfferRow key={o.id} offer={o} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  )
}

function Dashboard() {
  const { data, isLoading, isError, refetch } = useMyBusinesses()
  if (isLoading) return <Skeleton className="h-48 rounded-2xl" />
  if (isError) return <ErrorState onRetry={() => refetch()} />
  const businesses = data?.data ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild size="lg">
          <Link to="/business/scan">
            <ScanLine />
            {t('business.scan')}
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/business/locations/new">
            <Plus />
            {t('partner.addLocation')}
          </Link>
        </Button>
      </div>
      {isMockMode && <p className="text-xs text-muted-foreground">{t('partner.demoNote')}</p>}

      {businesses.length === 0 ? (
        <EmptyState
          icon={Store}
          title={t('business.empty')}
          action={
            <Button asChild>
              <Link to="/business/locations/new">{t('partner.addFirstLocation')}</Link>
            </Button>
          }
        />
      ) : (
        <section className="space-y-4">
          <h2 className="font-bold">{t('business.myBusinesses')}</h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {businesses.map((b) => (
              <LocationCard key={b.id} business={b} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export function BusinessDashboardPage() {
  return (
    <div>
      <PageHeader title={t('business.title')} subtitle={t('business.intro')} />
      <PartnerGuard>
        <Dashboard />
      </PartnerGuard>
    </div>
  )
}
