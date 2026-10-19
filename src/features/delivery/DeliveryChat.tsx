import { Loader2, MessageCircle } from 'lucide-react'
import { ApiError } from '@/api/client'
import { COURIER_MESSAGES, CUSTOMER_MESSAGES, type Reservation } from '@/api/types'
import { useDeliveryMessage } from '@/hooks/api'
import { t, type MessageKey } from '@/i18n'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Preset quick messages between courier and customer ("Silazim", "Kasnim
 * 10 min"…) — no free chat. Each one is also a push to the other side.
 */
export function DeliveryChat({ reservation: r, side }: { reservation: Reservation; side: 'courier' | 'customer' }) {
  const send = useDeliveryMessage()
  const messages = r.delivery?.messages ?? []
  const keys = side === 'courier' ? COURIER_MESSAGES : CUSTOMER_MESSAGES
  const active = r.status === 'confirmed' && r.delivery?.stage === 'on_the_way'
  if (!active && messages.length === 0) return null
  return (
    <div className="space-y-2">
      {messages.length > 0 && (
        <ul className="space-y-1.5" aria-live="polite">
          {messages.map((m) => {
            const mine = m.from === side
            return (
              <li key={m.at + m.key} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <span className={cn('max-w-[80%] rounded-2xl px-3 py-1.5 text-sm', mine ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                  {t(`chat.${m.key}` as MessageKey)}
                  <span className={cn('ml-2 text-[11px]', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{formatTime(m.at, r.timezone)}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {active && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('chat.quick')}>
          <MessageCircle className="mt-2 size-4 text-muted-foreground" />
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              disabled={send.isPending}
              onClick={() => send.mutate({ id: r.id, key })}
              className="min-h-9 rounded-full border bg-card px-3 text-sm font-semibold hover:bg-muted disabled:opacity-60"
            >
              {t(`chat.${key}` as MessageKey)}
            </button>
          ))}
          {send.isPending && <Loader2 className="mt-2 size-4 animate-spin text-muted-foreground" />}
        </div>
      )}
      {send.isError && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {send.error instanceof ApiError ? send.error.message : t('common.errorText')}
        </p>
      )}
    </div>
  )
}
