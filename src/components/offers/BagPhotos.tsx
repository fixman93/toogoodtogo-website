import { useState } from 'react'
import { Camera, X } from 'lucide-react'
import { Stars } from '@/components/offers/ReviewList'
import { useBusinessPhotos } from '@/hooks/api'
import { t } from '@/i18n'

/** Full-screen view of one photo (tap anywhere to close). */
export function PhotoViewer({ url, onClose, caption }: { url: string; onClose: () => void; caption?: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/90 p-4" onClick={onClose}>
      <button type="button" aria-label={t('common.close')} className="absolute top-4 right-4 rounded-full bg-white/15 p-2 text-white" onClick={onClose}>
        <X />
      </button>
      <img src={url} alt="" className="max-h-[80dvh] max-w-full rounded-2xl object-contain" />
      {caption && <div className="text-sm text-white/90">{caption}</div>}
    </div>
  )
}

/** "Šta je bilo u kesi": customer photos from reviews of this location. */
export function BagPhotos({ businessId }: { businessId: string }) {
  const { data } = useBusinessPhotos(businessId)
  const [open, setOpen] = useState<number | null>(null)
  if (!data?.length) return null
  const current = open != null ? data[open] : null
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 font-bold">
        <Camera className="size-5 text-primary" />
        {t('photos.title')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('photos.intro')}</p>
      <ul className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {data.map((p, i) => (
          <li key={`${p.reviewId}-${p.url}`} className="shrink-0">
            <button type="button" onClick={() => setOpen(i)} className="block overflow-hidden rounded-xl" aria-label={t('photos.open', { name: p.user })}>
              <img src={p.url} alt="" loading="lazy" className="size-28 object-cover transition-transform hover:scale-105" />
            </button>
          </li>
        ))}
      </ul>
      {current && (
        <PhotoViewer
          url={current.url}
          onClose={() => setOpen(null)}
          caption={
            <span className="flex items-center gap-2">
              {current.user} <Stars value={current.rating} />
            </span>
          }
        />
      )}
    </section>
  )
}
