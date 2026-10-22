import { useParams } from 'react-router'
import { CalendarClock, CheckCircle2, ExternalLink, Gift, Link2Off, MapPin, XCircle, Info } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { SafeImage } from '@/components/common/SafeImage'
import { EmptyState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePickupPass } from '@/hooks/api'
import { t } from '@/i18n'
import { formatMoney, formatPickupWindow } from '@/lib/format'
import { directionsUrl } from '@/lib/geo'
import { pickupQrValue } from '@/lib/pickup'

/** Public page behind "send to a friend": the QR + code to collect someone else's bag. */
export function PickupPassPage() {
  const { token } = useParams()
  const { data: pass, isLoading, isError } = usePickupPass(token)

  if (isLoading) return <Skeleton className="mx-auto h-96 max-w-md rounded-3xl" />
  if (isError || !pass) return <EmptyState icon={Link2Off} title={t('pickup.invalid')} />

  const active = pass.status === 'confirmed' || pass.status === 'pending_payment'
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center gap-3 rounded-2xl bg-secondary p-4 text-sm font-semibold text-secondary-foreground">
        <Gift className="size-5 shrink-0" />
        {t('pickup.forFriend')}
      </div>
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 p-5">
          <SafeImage src={pass.business.logoUrl} alt="" className="size-14 shrink-0 rounded-full" />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{pass.business.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {pass.quantity} × {pass.offerTitle} · {formatMoney(pass.totalMinor, pass.currency)}
            </p>
          </div>
        </div>
        {active ? (
          <div className="mx-5 mb-5 rounded-2xl border-2 border-dashed border-primary/30 bg-secondary/60 p-5 text-center">
            <div className="mx-auto w-fit rounded-2xl bg-white p-3 shadow-sm">
              <QRCodeSVG value={pickupQrValue(pass.reservationId, pass.code)} size={184} level="M" marginSize={0} fgColor="#0f3d2e" title={pass.code} />
            </div>
            <p className="mt-4 font-mono text-3xl font-extrabold tracking-widest text-primary">{pass.code}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t('reservations.qrHint')}</p>
            <p className="mx-auto mt-3 flex max-w-sm items-start justify-center gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {t('reservations.noGuarantee')}
            </p>
          </div>
        ) : (
          <div className="mx-5 mb-5 flex items-center gap-3 rounded-2xl bg-muted p-4 font-semibold">
            {pass.status === 'collected' ? <CheckCircle2 className="size-5 text-success" /> : <XCircle className="size-5 text-destructive" />}
            {pass.status === 'collected' ? t('pickup.done') : t('pickup.cancelled')}
          </div>
        )}
        <div className="divide-y border-t text-sm">
          <p className="flex items-center gap-3 px-5 py-4 font-semibold">
            <CalendarClock className="size-5 text-primary" />
            {formatPickupWindow(pass.pickupStart, pass.pickupEnd, pass.timezone)}
          </p>
          <div className="flex items-center gap-3 px-5 py-4">
            <MapPin className="size-5 shrink-0 text-primary" />
            <span className="flex-1">
              {pass.business.address.street}, {pass.business.address.city}
            </span>
          </div>
          {pass.business.collectionInstructions && <p className="px-5 py-4 text-muted-foreground">{pass.business.collectionInstructions}</p>}
        </div>
        <div className="p-4">
          <Button asChild variant="outline" className="w-full">
            <a href={directionsUrl(pass.business.location)} target="_blank" rel="noreferrer">
              {t('offer.directions')}
              <ExternalLink />
            </a>
          </Button>
        </div>
      </Card>
    </div>
  )
}
