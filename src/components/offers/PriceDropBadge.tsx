import { TrendingDown } from 'lucide-react'
import type { Offer } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { t } from '@/i18n'
import { formatMoney, formatTime } from '@/lib/format'

/** "Sniženo!" once the scheduled drop applies, "Od 19:00: 199 RSD" before it. */
export function PriceDropBadge({ offer, className }: { offer: Offer; className?: string }) {
  if (!offer.priceDrop) return null
  const dropped = offer.basePriceMinor != null && offer.priceMinor < offer.basePriceMinor
  return (
    <Badge variant={dropped ? 'destructive' : 'glass'} className={className}>
      <TrendingDown />
      {dropped
        ? t('offer.priceDropped')
        : t('offer.priceDropAt', { time: formatTime(offer.priceDrop.at, offer.timezone), price: formatMoney(offer.priceDrop.priceMinor, offer.currency) })}
    </Badge>
  )
}
