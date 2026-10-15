import { Link } from 'react-router'
import { Lock, ScanLine, Store } from 'lucide-react'
import type { Business } from '@/api/types'
import { PageHeader } from '@/components/common/PageHeader'
import { RequireAuth } from '@/components/common/RequireAuth'
import { SafeImage } from '@/components/common/SafeImage'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { useMyBusinesses, useOffers } from '@/hooks/api'
import { t } from '@/i18n'
import { formatMoney, formatPickupWindow } from '@/lib/format'

/**
 * Partner portal — foundation only. Lists the signed-in partner's businesses
 * and their live offers; create/edit forms will call the same
 * POST/PATCH /api/offers endpoints that already exist in the backend.
 */
function BusinessOffers({ business }: { business: Business }) {
  const { data, isLoading } = useOffers({ businessId: business.id })
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-4 border-b p-4">
        <SafeImage src={business.logoUrl} alt="" className="size-12 rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{business.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {business.address.street}, {business.address.city}
          </p>
        </div>
        <Badge variant={business.isActive ? 'success' : 'muted'}>{business.isActive ? 'Aktivan' : 'Neaktivan'}</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2.5 font-semibold">{t('business.offers')}</th>
              <th className="px-4 py-2.5 font-semibold">{t('offer.pickup')}</th>
              <th className="px-4 py-2.5 text-right font-semibold">Cena</th>
              <th className="px-4 py-2.5 text-right font-semibold">Dostupno</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="p-4">
                  <Skeleton className="h-6" />
                </td>
              </tr>
            ) : (
              data?.data.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-medium">{o.title}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatPickupWindow(o.pickupStart, o.pickupEnd, o.timezone)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatMoney(o.priceMinor, o.currency)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {o.quantityAvailable}/{o.quantityTotal}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Dashboard() {
  const { hasRole } = useAuth()
  const { data, isLoading, isError, refetch } = useMyBusinesses()
  if (!hasRole('business', 'admin')) return <EmptyState icon={Lock} title={t('business.noAccess')} />
  if (isLoading) return <Skeleton className="h-48 rounded-2xl" />
  if (isError) return <ErrorState onRetry={() => refetch()} />
  if (!data?.data.length) return <EmptyState icon={Store} title={t('business.empty')} />
  return (
    <div className="space-y-4">
      <Button asChild size="lg" className="w-full sm:w-auto">
        <Link to="/business/scan">
          <ScanLine />
          {t('business.scan')}
        </Link>
      </Button>
      <h2 className="font-bold">{t('business.myBusinesses')}</h2>
      {data.data.map((b) => (
        <BusinessOffers key={b.id} business={b} />
      ))}
      <p className="text-sm text-muted-foreground">{t('business.comingSoon')}</p>
    </div>
  )
}

export function BusinessDashboardPage() {
  return (
    <div>
      <PageHeader title={t('business.title')} subtitle={t('business.intro')} />
      <RequireAuth>
        <Dashboard />
      </RequireAuth>
    </div>
  )
}
