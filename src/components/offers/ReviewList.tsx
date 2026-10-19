import { useState } from 'react'
import { Star } from 'lucide-react'
import { PhotoViewer } from '@/components/offers/BagPhotos'
import { Skeleton } from '@/components/ui/skeleton'
import { useBusinessReviews } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDate } from '@/lib/format'

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
          <p className="text-xs text-muted-foreground/80">{formatDate(review.createdAt)}</p>
        </li>
      ))}
      {photo && <PhotoViewer url={photo} onClose={() => setPhoto(null)} />}
    </ul>
  )
}
