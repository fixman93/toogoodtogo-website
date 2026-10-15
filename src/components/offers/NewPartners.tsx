import { Link } from 'react-router'
import { MapPin, Sparkles } from 'lucide-react'
import { SafeImage } from '@/components/common/SafeImage'
import { Badge } from '@/components/ui/badge'
import { useNewPartners } from '@/hooks/api'
import { t } from '@/i18n'

/** Discover: the newest partner locations (links to their profile). */
export function NewPartners() {
  const { data } = useNewPartners()
  const items = data?.data ?? []
  if (!items.length) return null
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
        <Sparkles className="size-5 text-accent-foreground" />
        {t('discover.newPartners')}
      </h2>
      <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {items.map((b) => (
          <Link
            key={b.id}
            to={`/businesses/${b.id}`}
            className="w-56 shrink-0 snap-start overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card transition-transform hover:-translate-y-0.5"
          >
            <div className="relative h-24">
              <SafeImage src={b.coverUrl} alt="" className="size-full" />
              <Badge variant="accent" className="absolute top-2 left-2">
                {t('common.new')}
              </Badge>
            </div>
            <div className="flex items-center gap-2.5 p-3">
              <SafeImage src={b.logoUrl} alt="" className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{b.name}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <MapPin className="size-3" />
                  {b.address.city} · {t(`category.${b.category}`)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
