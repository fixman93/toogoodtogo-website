import { useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, Ban, ChevronDown, LifeBuoy, PauseCircle } from 'lucide-react'
import type { PartnerNote } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/features/auth/auth-context'
import { useMyStanding } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const KIND_BADGE = { warning: 'accent', paused: 'muted', blocked: 'destructive', reactivated: 'success', deleted: 'destructive' } as const

/** One entry of a partner's moderation history (partner portal and admin panel). */
export function NoteItem({ note, action }: { note: PartnerNote; action?: React.ReactNode }) {
  return (
    <li className={cn('space-y-1 py-2.5 text-sm', note.resolvedAt && 'opacity-60')}>
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={KIND_BADGE[note.kind]}>{t(`pm.kind.${note.kind}`)}</Badge>
        {formatDate(note.createdAt)}
        {note.author && ` · ${note.author}`}
        {note.resolvedAt && ` · ${t('pm.resolved', { date: formatDate(note.resolvedAt) })}`}
      </p>
      {note.message && <p className="whitespace-pre-line">{note.message}</p>}
      {action}
    </li>
  )
}

/**
 * Shown to a partner on their portal and profile when the platform team has
 * paused/blocked the account or left a warning. Renders nothing otherwise.
 */
export function StandingNotice({ className }: { className?: string }) {
  const { hasRole } = useAuth()
  const { data } = useMyStanding(hasRole('business'))
  const [showHistory, setShowHistory] = useState(false)
  if (!data) return null

  const suspended = data.status === 'paused' || data.status === 'blocked'
  const warnings = data.history.filter((n) => n.kind === 'warning' && !n.resolvedAt)
  if (!suspended && warnings.length === 0) return null
  const Icon = data.status === 'blocked' ? Ban : suspended ? PauseCircle : AlertTriangle

  return (
    <Card role="alert" className={cn('space-y-3 border-2 p-4', suspended ? 'border-destructive/40 bg-destructive/5' : 'border-accent bg-accent/15', className)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 size-5 shrink-0', suspended ? 'text-destructive' : 'text-accent-foreground')} />
        <div className="min-w-0 space-y-1">
          <p className="font-bold">{suspended ? t(`standing.${data.status as 'paused' | 'blocked'}.title`) : t('standing.warningsTitle')}</p>
          {suspended && <p className="text-sm">{t('standing.pausedBody')}</p>}
          {suspended && data.reason && <p className="text-sm font-semibold">{t('standing.reason', { reason: data.reason })}</p>}
          {!suspended && <p className="text-sm text-muted-foreground">{t('standing.warningsHint')}</p>}
        </div>
      </div>

      {warnings.length > 0 && (
        <ul className="divide-y rounded-xl bg-card px-3">
          {warnings.map((n) => (
            <NoteItem key={n.id} note={n} />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/support" className="flex items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-primary hover:underline">
          <LifeBuoy className="size-4" />
          {t('standing.contact')}
        </Link>
        <button
          type="button"
          aria-expanded={showHistory}
          onClick={() => setShowHistory((v) => !v)}
          className="flex min-h-9 items-center gap-1 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
        >
          {t('standing.history')}
          <ChevronDown className={cn('size-4 transition-transform', showHistory && 'rotate-180')} />
        </button>
      </div>
      {showHistory && (
        <ul className="divide-y rounded-xl bg-card px-3">
          {data.history.map((n) => (
            <NoteItem key={n.id} note={n} />
          ))}
        </ul>
      )}
    </Card>
  )
}
