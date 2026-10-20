import { useState } from 'react'
import { Link } from 'react-router'
import { BarChart3, ChevronDown, ChevronRight, ClipboardList, Clock, Copy, HandHeart, MapPin, Megaphone, MonitorSmartphone, Pause, Pencil, Play, Plug, Plus, ReceiptText, Repeat, ScanLine, ShieldCheck, Store, TicketPercent, Users, type LucideIcon } from 'lucide-react'
import type { Business, Offer } from '@/api/types'
import { PageHeader } from '@/components/common/PageHeader'
import { SafeImage } from '@/components/common/SafeImage'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StaffGuard } from '@/features/business/PartnerGuard'
import { StaffSection } from '@/features/business/StaffSection'
import { StandingNotice } from '@/features/business/StandingNotice'
import { BoostPanel } from '@/features/business/BoostPanel'
import { useAuth } from '@/features/auth/auth-context'
import { ConfirmDelete } from '@/components/common/ConfirmDelete'
import { SalesTiles } from '@/pages/partner/SalesPage'
import { useBusinessOffers, useDeleteBusiness, useDeleteOffer, useMyBusinesses, usePartnerSales, useSaveOffer, useWorkplaces } from '@/hooks/api'
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
  const remove = useDeleteOffer()
  const [boosting, setBoosting] = useState(false)
  const past = isPast(offer)
  const canBoost = !past && offer.status === 'active' && offer.quantityAvailable > 0
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
        <span className="flex shrink-0 flex-col items-end gap-1">
          <OfferStatus offer={offer} />
          {offer.boosted && !past && <Badge variant="accent">{t('boost.badge')}</Badge>}
          {offer.scheduleId && (
            <Link to="/business/schedules" className="flex items-center gap-1 text-xs font-semibold text-primary">
              <Repeat className="size-3" />
              {t('repeat.badge')}
            </Link>
          )}
        </span>
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
        {canBoost && (
          <Button size="sm" variant={boosting ? 'secondary' : 'outline'} aria-expanded={boosting} onClick={() => setBoosting((v) => !v)}>
            <Megaphone />
            {t('boost.open')}
          </Button>
        )}
        <Button asChild size="sm" variant={past ? 'secondary' : 'ghost'}>
          <Link to={`/business/offers/new?copy=${offer.id}`}>
            <Copy />
            {t('partner.repeatOffer')}
          </Link>
        </Button>
        <ConfirmDelete
          label={t('partner.deleteShort')}
          question={t('partner.deleteConfirmShort', { title: offer.title })}
          onConfirm={() => remove.mutate(offer.id)}
          pending={remove.isPending}
          error={remove.error}
          className="basis-full sm:basis-auto"
        />
      </div>
      {boosting && canBoost && <BoostPanel offerId={offer.id} />}
    </li>
  )
}

function LocationCard({ business }: { business: Business }) {
  const { data, isLoading } = useBusinessOffers(business.id)
  const removeLocation = useDeleteBusiness()
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

      <div className="flex flex-wrap gap-2 border-b bg-muted/30 px-4 py-3">
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
        <ConfirmDelete
          label={t('partner.deleteLocation')}
          question={t('partner.deleteLocationConfirm', { name: business.name })}
          hint={t('partner.deleteLocationHint')}
          onConfirm={() => removeLocation.mutate(business.id)}
          pending={removeLocation.isPending}
          error={removeLocation.error}
          className="basis-full"
        />
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
      <StaffSection businessId={business.id} />
    </Card>
  )
}

function Tile({ to, icon: Icon, label, primary }: { to: string; icon: LucideIcon; label: string; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex min-h-20 flex-col items-start justify-between gap-2 rounded-2xl border p-3.5 text-sm font-semibold transition-colors',
        primary ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-card hover:bg-muted',
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  )
}

/** Staff members only see the locations they work at, the scanner and orders. */
function StaffPortal() {
  const { data } = useWorkplaces(true)
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile to="/business/scan" icon={ScanLine} label={t('business.scan')} primary />
        <Tile to="/business/orders" icon={ClipboardList} label={t('orders.title')} />
        <Tile to="/business/counter" icon={MonitorSmartphone} label={t('counter.title')} />
      </div>
      <section className="space-y-2">
        <h2 className="font-bold">{t('staff.workplaces')}</h2>
        {data?.map((b) => (
          <Card key={b.id} className="flex items-center gap-3 p-4">
            <Store className="size-5 text-primary" />
            <span>
              <span className="block font-semibold">{b.name}</span>
              <span className="text-sm text-muted-foreground">
                {b.address.street}, {b.address.city}
              </span>
            </span>
          </Card>
        ))}
      </section>
    </div>
  )
}

function TodaySummary() {
  const { data } = usePartnerSales()
  if (!data || data.bagsTotal === 0) return null
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">{t('sales.todayTitle')}</h2>
        <Link to="/business/sales" className="flex items-center gap-0.5 rounded-full px-2 py-1 text-sm font-semibold text-primary hover:bg-secondary">
          {t('sales.link')}
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <SalesTiles report={data} />
    </section>
  )
}

function Dashboard() {
  const { data, isLoading, isError, refetch } = useMyBusinesses()
  if (isLoading) return <Skeleton className="h-48 rounded-2xl" />
  if (isError) return <ErrorState onRetry={() => refetch()} />
  const businesses = data?.data ?? []

  return (
    <div className="space-y-5">
      <StandingNotice />
      <Button asChild size="lg" className="h-14 w-full text-lg">
        <Link to="/business/new">
          <Plus />
          {t('nav.newOffer')}
        </Link>
      </Button>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile to="/business/scan" icon={ScanLine} label={t('business.scan')} primary />
        <Tile to="/business/orders" icon={ClipboardList} label={t('orders.title')} />
        <Tile to="/business/sales" icon={BarChart3} label={t('sales.link')} />
        <Tile to="/business/locations/new" icon={Plus} label={t('partner.addLocation')} />
        <Tile to="/business/schedules" icon={Repeat} label={t('repeat.title')} />
        <Tile to="/business/counter" icon={MonitorSmartphone} label={t('counter.title')} />
        <Tile to="/business/promotions" icon={TicketPercent} label={t('promo.title')} />
        <Tile to="/business/donations" icon={HandHeart} label={t('donations.title')} />
        <Tile to="/business/statements" icon={ReceiptText} label={t('statement.title')} />
        <Tile to="/business/pickups" icon={ShieldCheck} label={t('pickups.title')} />
        <Tile to="/business/team" icon={Users} label={t('team.title')} />
        <Tile to="/business/integrations" icon={Plug} label={t('integrations.title')} />
      </div>

      <TodaySummary />

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

function Portal() {
  const { hasRole } = useAuth()
  return hasRole('staff') ? <StaffPortal /> : <Dashboard />
}

export function BusinessDashboardPage() {
  const { hasRole } = useAuth()
  const staff = hasRole('staff')
  return (
    <div>
      <PageHeader title={staff ? t('staff.portalTitle') : t('business.title')} subtitle={staff ? t('staff.portalIntro') : t('business.intro')} />
      <StaffGuard>
        <Portal />
      </StaffGuard>
    </div>
  )
}
