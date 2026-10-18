import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { Link, useLocation as useRouterLocation, useParams } from 'react-router'
import { ArrowLeft, CalendarClock, CheckCircle2, ExternalLink, Info, Leaf, Loader2, MapPin, ReceiptText, Send, Star } from 'lucide-react'
import type { Reservation } from '@/api/types'
import { ApiError } from '@/api/client'
import { RequireAuth } from '@/components/common/RequireAuth'
import { SafeImage } from '@/components/common/SafeImage'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { StatusBadge } from '@/components/reservations/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAddReview, useBusiness, useCancelReservation, usePickupCheck, useReservation, useShareReservation } from '@/hooks/api'
import { t } from '@/i18n'
import { formatMoney, formatPickupWindow, formatTime } from '@/lib/format'
import { pickupQrValue } from '@/lib/pickup'
import { directionsUrl } from '@/lib/geo'

function Details() {
  const { id } = useParams()
  const routerLocation = useRouterLocation()
  const justReserved = (routerLocation.state as { justReserved?: boolean } | null)?.justReserved
  const { data: r, isLoading, isError, error, refetch } = useReservation(id)
  const { data: business } = useBusiness(r?.business.id)
  const cancel = useCancelReservation()
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()

  // When the shop scans the code, polling flips the status to "collected":
  // refresh lists so history and profile stats include the new pickup.
  const previousStatus = useRef(r?.status)
  useEffect(() => {
    if (previousStatus.current && previousStatus.current !== r?.status) {
      queryClient.invalidateQueries({ queryKey: ['reservations', 'list'] })
    }
    previousStatus.current = r?.status
  }, [r?.status, queryClient])

  if (isLoading) return <Skeleton className="h-96 rounded-3xl" />
  if (isError) {
    if (error instanceof ApiError && error.status === 404) return <EmptyState icon={ReceiptText} title={t('reservations.notFound')} />
    return <ErrorState onRetry={() => refetch()} />
  }
  if (!r) return null

  const active = r.status === 'confirmed' || r.status === 'pending_payment'

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {justReserved && r.status === 'confirmed' && (
        <div role="status" className="flex items-center gap-3 rounded-2xl bg-success/12 p-4 font-semibold text-success">
          <CheckCircle2 className="size-6 shrink-0" />
          {t('offer.reserved')}
        </div>
      )}
      {/* Asked first: it's why the customer opened this reservation from the notification. */}
      <PickupCheck reservation={r} />
      {r.status === 'collected' && (
        <div role="status" className="flex items-start gap-4 rounded-2xl bg-success/12 p-5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success text-white">
            <CheckCircle2 className="size-7" />
          </span>
          <div>
            <p className="text-lg font-extrabold text-success">{t('reservations.collectedTitle')}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-foreground/80">
              <Leaf className="size-4 shrink-0 text-success" />
              {t('reservations.collectedText', {
                count: t('offer.bags', { count: r.quantity }),
                amount: formatMoney((r.originalUnitPriceMinor - r.unitPriceMinor) * r.quantity, r.currency),
              })}
            </p>
            {r.collectedAt && (
              <p className="mt-1 text-xs text-muted-foreground">{t('reservations.collectedAt', { time: formatTime(r.collectedAt, r.timezone) })}</p>
            )}
          </div>
        </div>
      )}
      {cancel.isSuccess && (
        <div role="status" className="rounded-2xl bg-muted p-4 text-sm font-semibold">
          {t('reservations.cancelled')}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 p-5">
          <SafeImage src={r.business.logoUrl} alt="" className="size-14 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{r.business.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {r.quantity} × {r.offer.title}
            </p>
          </div>
          <StatusBadge status={r.status} />
        </div>

        {active && (
          <div className="mx-5 mb-5 rounded-2xl border-2 border-dashed border-primary/30 bg-secondary/60 p-5 text-center">
            <div className="mx-auto w-fit rounded-2xl bg-white p-3 shadow-sm">
              <QRCodeSVG value={pickupQrValue(r.id, r.code)} size={184} level="M" marginSize={0} fgColor="#0f3d2e" title={r.code} />
            </div>
            <p className="mt-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{t('reservations.code')}</p>
            <p className="mt-1 font-mono text-3xl font-extrabold tracking-widest text-primary">{r.code}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t('reservations.qrHint')}</p>
          </div>
        )}

        <dl className="divide-y border-t text-sm">
          <div className="flex items-center gap-3 px-5 py-4">
            <CalendarClock className="size-5 shrink-0 text-primary" />
            <dt className="sr-only">{t('offer.pickup')}</dt>
            <dd className="font-semibold">{formatPickupWindow(r.pickupStart, r.pickupEnd, r.timezone)}</dd>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <MapPin className="size-5 shrink-0 text-primary" />
            <dt className="sr-only">{t('offer.address')}</dt>
            <dd className="flex-1">
              {r.business.address.street}, {r.business.address.city}
            </dd>
            <a href={directionsUrl(r.business.location)} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-primary">
              {t('offer.directions')}
              <ExternalLink className="size-3.5" />
            </a>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <dt className="text-muted-foreground">{t(`reservations.payment.${r.payment.status}`)}</dt>
            <dd className="text-right">
              <span className="block text-xs text-muted-foreground line-through">{formatMoney(r.originalUnitPriceMinor * r.quantity, r.currency)}</span>
              {!!r.discountMinor && (
                <span className="block text-xs font-semibold text-success">
                  {t('reservations.discount', { code: r.promoCode ?? '' })}: −{formatMoney(r.discountMinor, r.currency)}
                </span>
              )}
              <span className="text-lg font-extrabold">
                {t('reservations.total')}: {formatMoney(r.totalMinor, r.currency)}
              </span>
            </dd>
          </div>
        </dl>
      </Card>

      {r.status === 'collected' && <ReviewForm reservation={r} />}
      {active && <ShareWithFriend reservationId={r.id} />}
      <Link to={`/support?reservation=${r.id}`} className="block text-center text-sm font-semibold text-muted-foreground underline">
        {t('profile.support')}
      </Link>

      {business?.collectionInstructions && active && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="size-5 text-primary" />
              {t('offer.instructions')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed">{business.collectionInstructions}</CardContent>
        </Card>
      )}

      {active &&
        (r.canCancel ? (
          confirming ? (
            <Card className="space-y-3 p-5 text-center">
              <p className="font-semibold">{t('reservations.cancelConfirm')}</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirming(false)}>
                  {t('reservations.cancelNo')}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate(r.id, { onSettled: () => setConfirming(false) })}
                >
                  {cancel.isPending && <Loader2 className="animate-spin" />}
                  {t('reservations.cancelYes')}
                </Button>
              </div>
            </Card>
          ) : (
            <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10" onClick={() => setConfirming(true)}>
              {t('reservations.cancel')}
            </Button>
          )
        ) : (
          <p className="text-center text-sm text-muted-foreground">{t('reservations.cannotCancel')}</p>
        ))}
      {cancel.isError && (
        <p role="alert" className="text-center text-sm text-destructive">
          {cancel.error instanceof ApiError ? cancel.error.message : t('common.errorText')}
        </p>
      )}
    </div>
  )
}

/** 1–5 stars + optional comment, shown once after pickup. */
const PICKUP_CHECK_DAYS = 7

/**
 * Expired without a recorded hand-over: ask the customer. "Yes" counts the
 * pickup (points, review) — so a bag handed over without scanning isn't lost.
 */
function PickupCheck({ reservation: r }: { reservation: Reservation }) {
  const answer = usePickupCheck()
  const [now] = useState(() => Date.now())
  const open = r.status === 'expired' && r.pickupCheck && !r.pickupCheck.answer && now - new Date(r.pickupEnd).getTime() < PICKUP_CHECK_DAYS * 86_400_000
  if (r.pickupCheck?.answer === 'not_collected') return <p className="text-center text-sm text-muted-foreground">{t('pickupCheck.thanks')}</p>
  if (!open) return null
  return (
    <Card className="space-y-3 border-2 border-primary/30 p-5">
      <p className="text-lg font-extrabold">{t('pickupCheck.title')}</p>
      <p className="text-sm text-muted-foreground">{t('pickupCheck.text', { business: r.business.name })}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="h-12 w-full sm:w-auto sm:flex-1" disabled={answer.isPending} onClick={() => answer.mutate({ id: r.id, answer: 'collected' })}>
          {answer.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          {t('pickupCheck.yes')}
        </Button>
        <Button variant="outline" className="h-12 w-full sm:w-auto sm:flex-1" disabled={answer.isPending} onClick={() => answer.mutate({ id: r.id, answer: 'not_collected' })}>
          {t('pickupCheck.no')}
        </Button>
      </div>
      {answer.isError && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {answer.error instanceof ApiError ? answer.error.message : t('common.errorText')}
        </p>
      )}
    </Card>
  )
}

function ReviewForm({ reservation }: { reservation: Reservation }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const add = useAddReview(reservation.business.id)
  // Keep the thank-you visible even after the refetch marks it as reviewed.
  if (!add.isSuccess && reservation.reviewed) return null
  if (add.isSuccess) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-2xl bg-success/12 p-4 font-semibold text-success">
        <CheckCircle2 className="size-5" />
        {t('reservations.rateThanks')}
      </div>
    )
  }
  return (
    <Card className="space-y-3 p-5">
      <div>
        <p className="font-bold">{t('reservations.rateTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('reservations.rateText')}</p>
      </div>
      <div className="flex gap-1" role="radiogroup" aria-label={t('reservations.rateTitle')}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value}/5`}
            onClick={() => setRating(value)}
            className="flex size-11 items-center justify-center rounded-full hover:bg-muted"
          >
            <Star className={value <= rating ? 'size-7 fill-warning text-warning' : 'size-7 text-border'} />
          </button>
        ))}
      </div>
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder={t('reservations.ratePlaceholder')} className="min-h-20" />
      {add.isError && (
        <p role="alert" className="text-sm text-destructive">
          {add.error instanceof ApiError ? add.error.message : t('common.errorText')}
        </p>
      )}
      <Button
        disabled={!rating || add.isPending}
        onClick={() => add.mutate({ reservationId: reservation.id, rating, comment: comment.trim() || undefined })}
      >
        {add.isPending && <Loader2 className="animate-spin" />}
        {t('reservations.rateSubmit')}
      </Button>
    </Card>
  )
}

/** "Send to a friend": a secret link with this pickup's QR code. */
function ShareWithFriend({ reservationId }: { reservationId: string }) {
  const share = useShareReservation()
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const onShare = async () => {
    const { token } = await share.mutateAsync(reservationId)
    const url = `${window.location.origin}/pickup/${token}`
    setLink(url)
    if (navigator.share) {
      try {
        await navigator.share({ title: t('pickup.title'), text: t('reservations.shareMessage'), url })
        return
      } catch {
        /* user closed the share sheet — fall back to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      /* clipboard blocked: the link is shown below */
    }
  }

  return (
    <Card className="space-y-3 p-5">
      <p className="text-sm text-muted-foreground">{t('reservations.shareText')}</p>
      <Button variant="outline" className="w-full" disabled={share.isPending} onClick={onShare}>
        {share.isPending ? <Loader2 className="animate-spin" /> : <Send />}
        {t('reservations.share')}
      </Button>
      {link && (
        <div className="space-y-1">
          <input readOnly value={link} onFocus={(e) => e.target.select()} className="w-full rounded-lg border bg-muted px-3 py-2 font-mono text-xs" aria-label="Link" />
          {copied && <p className="text-xs font-semibold text-success">{t('reservations.shareCopied')}</p>}
        </div>
      )}
    </Card>
  )
}

export function ReservationDetailsPage() {
  return (
    <div>
      <Button asChild variant="ghost" className="mb-3 -ml-3">
        <Link to="/reservations">
          <ArrowLeft />
          {t('reservations.title')}
        </Link>
      </Button>
      <RequireAuth>
        <Details />
      </RequireAuth>
    </div>
  )
}
