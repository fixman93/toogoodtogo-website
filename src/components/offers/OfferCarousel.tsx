import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Offer } from '@/api/types'
import { ErrorState, OfferCardSkeleton } from '@/components/common/StateViews'
import { t } from '@/i18n'
import { OfferCard } from './OfferCard'

/** Horizontally scrolling row of offers with a section heading. */
export function OfferCarousel({
  title,
  offers,
  isLoading,
  isError,
  onRetry,
  seeAllTo,
  emptyState,
}: {
  title: string
  offers?: Offer[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  seeAllTo: string
  /** Shown under the heading when there are no offers; without it the whole row is hidden. */
  emptyState?: ReactNode
}) {
  const isEmpty = !isLoading && !isError && offers?.length === 0
  if (isEmpty && !emptyState) return null
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold sm:text-xl">{title}</h2>
        {!isEmpty && (
          <Link to={seeAllTo} className="flex items-center gap-0.5 rounded-full px-2 py-1 text-sm font-semibold text-primary hover:bg-secondary">
            {t('discover.seeAll')}
            <ChevronRight className="size-4" />
          </Link>
        )}
      </div>
      {isEmpty ? (
        emptyState
      ) : isError ? (
        <ErrorState onRetry={onRetry} className="rounded-2xl border bg-card py-8" />
      ) : (
        <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {/* No data yet also covers a paused query (offline / network blocked) — show placeholders, never crash. */}
          {isLoading || !offers
            ? Array.from({ length: 3 }, (_, i) => <OfferCardSkeleton key={i} className="w-[80vw] max-w-80 shrink-0" />)
            : offers.map((offer) => <OfferCard key={offer.id} offer={offer} className="w-[80vw] max-w-80 shrink-0 snap-start" />)}
        </div>
      )}
    </section>
  )
}
