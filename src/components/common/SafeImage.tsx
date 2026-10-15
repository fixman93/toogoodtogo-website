import { useState } from 'react'
import { UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Image with a branded fallback when the URL is missing or fails to load. */
export function SafeImage({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className={cn('flex items-center justify-center bg-gradient-to-br from-secondary to-accent/40', className)}>
        <UtensilsCrossed className="size-8 text-primary/40" />
      </div>
    )
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={cn('object-cover', className)} />
}
