import { useState } from 'react'
import { Flag, Loader2, Star } from 'lucide-react'
import { PhotoViewer } from '@/components/offers/BagPhotos'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/auth-context'
import { useBusinessReviews, useReportReview } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDate } from '@/lib/format'

function ReportReview({ businessId, reviewId }: { businessId: string; reviewId: string }) {
  const report = useReportReview(businessId)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  if (report.isSuccess) {
    return <span className="text-xs text-muted-foreground">{t('offer.reportReviewSent')}</span>
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
        <Flag className="size-3" />
        {t('offer.reportReview')}
      </button>
    )
  }
  return (
    <div className="space-y-2 rounded-lg border p-2">
      <p className="text-xs">{t('offer.reportReviewConfirm')}</p>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('offer.reportReviewReason')}
        className="min-h-16 text-xs"
      />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </Button>
        <Button size="sm" variant="destructive" className="flex-1" disabled={report.isPending} onClick={() => report.mutate({ reviewId, reason: reason.trim() || undefined })}>
          {report.isPending && <Loader2 className="animate-spin" />}
          {t('offer.reportReviewSubmit')}
        </Button>
      </div>
    </div>
  )
}

export function Stars({ value, size = 'size-3.5' }: { value: number; size?: string }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={i < value ? `${size} fill-warning text-warning` : `${size} text-border`} />
      ))}
    </span>
  )
}

export function ReviewList({ businessId }: { businessId: string }) {
  const { user } = useAuth()
  const { data, isLoading } = useBusinessReviews(businessId)
  const [photo, setPhoto] = useState<string | null>(null)
  if (isLoading) return <Skeleton className="h-24" />
  if (!data?.data.length) return <p className="text-sm text-muted-foreground">{t('offer.noReviews')}</p>
  return (
    <ul className="space-y-4">
      {data.data.map((review) => (
        <li key={review.id} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">{review.user.name}</span>
            <Stars value={review.rating} />
          </div>
          {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
          {!!review.photos?.length && (
            <div className="flex gap-2 pt-1">
              {review.photos.map((url) => (
                <button key={url} type="button" onClick={() => setPhoto(url)} className="overflow-hidden rounded-lg" aria-label={t('photos.openOne')}>
                  <img src={url} alt="" loading="lazy" className="size-16 object-cover" />
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground/80">{formatDate(review.createdAt)}</p>
            {user && user.id !== review.user.id && <ReportReview businessId={businessId} reviewId={review.id} />}
          </div>
        </li>
      ))}
      {photo && <PhotoViewer url={photo} onClose={() => setPhoto(null)} />}
    </ul>
  )
}
