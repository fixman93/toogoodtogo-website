import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { ApiError } from '@/api/client'
import type { SupportTicket } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useCloseTicket, useReplyTicket } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDayLabel, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const TICKET_BADGE = { open: 'accent', answered: 'success', closed: 'muted' } as const

export function TicketStatusBadge({ status }: { status: SupportTicket['status'] }) {
  return <Badge variant={TICKET_BADGE[status]}>{t(`support.status.${status}`)}</Badge>
}

/** Conversation view shared by the user's support page and the admin panel. */
export function TicketThread({ ticket, asTeam = false }: { ticket: SupportTicket; asTeam?: boolean }) {
  const reply = useReplyTicket(ticket.id)
  const close = useCloseTicket(ticket.id)
  const [body, setBody] = useState('')
  const closed = ticket.status === 'closed'

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">{ticket.subject}</p>
          <p className="text-xs text-muted-foreground">
            {t(`support.category.${ticket.category}`)}
            {asTeam && ticket.user && ` · ${ticket.user.name} (${ticket.user.email})`}
          </p>
        </div>
        <TicketStatusBadge status={ticket.status} />
      </div>
      <ul className="space-y-2">
        {ticket.messages?.map((m, i) => (
          <li key={i} className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm', m.fromTeam ? 'bg-secondary' : 'ml-auto bg-primary text-primary-foreground')}>
            <p className="text-xs font-semibold opacity-80">{m.fromTeam ? t('support.team') : m.author}</p>
            <p className="whitespace-pre-wrap">{m.body}</p>
            <p className="mt-0.5 text-[11px] opacity-70">
              {formatDayLabel(m.createdAt)} {formatTime(m.createdAt)}
            </p>
          </li>
        ))}
      </ul>
      {closed && !asTeam ? (
        <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{t('support.closedNote')}</p>
      ) : (
        <Card className="space-y-2 p-3">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} className="min-h-20" placeholder={t('support.message')} />
          {(reply.isError || close.isError) && (
            <p role="alert" className="text-sm text-destructive">
              {(reply.error ?? close.error) instanceof ApiError ? (reply.error ?? close.error)!.message : t('common.errorText')}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!body.trim() || reply.isPending} onClick={() => reply.mutate(body.trim(), { onSuccess: () => setBody('') })}>
              {reply.isPending ? <Loader2 className="animate-spin" /> : <Send />}
              {t('support.reply')}
            </Button>
            {!closed && (
              <Button size="sm" variant="ghost" disabled={close.isPending} onClick={() => close.mutate()}>
                {t('support.close')}
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
