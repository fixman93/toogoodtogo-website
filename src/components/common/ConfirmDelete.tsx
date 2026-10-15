import { useState, type ReactNode } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

/**
 * Delete button that asks for confirmation inline (no browser dialogs) and
 * shows the API's reason when deletion is refused, e.g. active reservations.
 */
export function ConfirmDelete({
  label,
  question,
  hint,
  onConfirm,
  pending,
  error,
  size = 'sm',
  className,
}: {
  label: string
  question: ReactNode
  hint?: string
  onConfirm: () => void
  pending: boolean
  error: unknown
  size?: 'sm' | 'default'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const message = error ? (error instanceof ApiError ? error.message : t('common.errorText')) : null

  if (!open) {
    return (
      <div className={className}>
        <Button type="button" size={size} variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setOpen(true)}>
          <Trash2 />
          {label}
        </Button>
      </div>
    )
  }

  return (
    <div role="alertdialog" aria-label={label} className={cn('w-full space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3', className)}>
      <p className="text-sm font-semibold">{question}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {message && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {message}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
          {t('reservations.cancelNo')}
        </Button>
        <Button type="button" size="sm" variant="destructive" className="flex-1" disabled={pending} onClick={onConfirm}>
          {pending && <Loader2 className="animate-spin" />}
          {t('partner.deleteYes')}
        </Button>
      </div>
    </div>
  )
}
