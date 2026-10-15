import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Price({
  priceMinor,
  originalPriceMinor,
  currency,
  size = 'md',
  className,
}: {
  priceMinor: number
  originalPriceMinor: number
  currency: string
  size?: 'md' | 'lg'
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-end leading-tight', className)}>
      <span className={cn('text-muted-foreground line-through', size === 'lg' ? 'text-sm' : 'text-xs')}>
        {formatMoney(originalPriceMinor, currency)}
      </span>
      <span className={cn('font-extrabold text-primary', size === 'lg' ? 'text-2xl' : 'text-lg')}>{formatMoney(priceMinor, currency)}</span>
    </div>
  )
}
