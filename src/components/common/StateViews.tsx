import type { ReactNode } from 'react'
import { AlertTriangle, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  text?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-secondary">
        <Icon className="size-7 text-primary" />
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      {text && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ onRetry, message, className }: { onRetry?: () => void; message?: string; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <h3 className="text-base font-bold">{t('common.errorTitle')}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message ?? t('common.errorText')}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}

export function OfferCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-border/70 bg-card', className)} aria-hidden>
      <Skeleton className="h-36 rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3.5 w-1/3" />
      </div>
    </div>
  )
}
