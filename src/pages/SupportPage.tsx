import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { ArrowLeft, LifeBuoy, Loader2, MessageSquarePlus } from 'lucide-react'
import { ApiError } from '@/api/client'
import type { TicketCategory } from '@/api/types'
import { FormField, FormSection } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { RequireAuth } from '@/components/common/RequireAuth'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { TicketStatusBadge, TicketThread } from '@/features/support/TicketThread'
import { useCreateTicket, useMyTickets, useTicket } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDayLabel } from '@/lib/format'

const CATEGORIES: TicketCategory[] = ['order', 'partner', 'account', 'other']

function NewTicket({ onDone }: { onDone: (id: string) => void }) {
  const [params] = useSearchParams()
  const create = useCreateTicket()
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<TicketCategory>(params.get('reservation') ? 'order' : 'other')
  const [message, setMessage] = useState('')
  const reservationId = params.get('reservation') ?? undefined
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    create.mutate({ subject: subject.trim(), category, message: message.trim(), reservationId }, { onSuccess: (ticket) => onDone(ticket.id) })
  }
  return (
    <form onSubmit={onSubmit}>
      <FormSection title={t('support.new')}>
        <FormField label={t('support.subject')} htmlFor="subject">
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} required />
        </FormField>
        <FormField label={t('support.category')} htmlFor="category">
          <NativeSelect id="category" value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`support.category.${c}`)}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label={t('support.message')} htmlFor="message">
          <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={3000} required />
        </FormField>
        {create.isError && (
          <p role="alert" className="text-sm text-destructive">
            {create.error instanceof ApiError ? create.error.message : t('common.errorText')}
          </p>
        )}
        <Button type="submit" disabled={subject.trim().length < 3 || message.trim().length < 5 || create.isPending}>
          {create.isPending && <Loader2 className="animate-spin" />}
          {t('support.send')}
        </Button>
      </FormSection>
    </form>
  )
}

function Tickets() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [composing, setComposing] = useState(params.has('new') || params.has('reservation'))
  const { data, isLoading, isError, refetch } = useMyTickets()
  return (
    <div className="space-y-4">
      {composing ? (
        <NewTicket onDone={(id) => navigate(`/support/${id}`)} />
      ) : (
        <Button onClick={() => setComposing(true)}>
          <MessageSquarePlus />
          {t('support.new')}
        </Button>
      )}
      {isLoading ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data?.length ? (
        !composing && <EmptyState icon={LifeBuoy} title={t('support.empty')} className="py-8" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y">
            {data.map((ticket) => (
              <li key={ticket.id}>
                <Link to={`/support/${ticket.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{ticket.subject}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t(`support.category.${ticket.category}`)} · {formatDayLabel(ticket.lastMessageAt)}
                    </span>
                  </span>
                  <TicketStatusBadge status={ticket.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function Ticket({ id }: { id: string }) {
  const { data, isLoading, isError, refetch } = useTicket(id)
  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />
  return <TicketThread ticket={data} />
}

export function SupportPage() {
  const { id } = useParams()
  return (
    <div className="mx-auto max-w-2xl">
      {id && (
        <Button asChild variant="ghost" className="mb-3 -ml-3">
          <Link to="/support">
            <ArrowLeft />
            {t('support.title')}
          </Link>
        </Button>
      )}
      <PageHeader title={t('support.title')} subtitle={id ? undefined : t('support.intro')} />
      <RequireAuth>{id ? <Ticket id={id} /> : <Tickets />}</RequireAuth>
    </div>
  )
}
