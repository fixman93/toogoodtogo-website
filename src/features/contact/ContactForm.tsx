import { useState, type FormEvent, type Ref } from 'react'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { contactApi, type ContactTopic } from '@/api/services'
import { FormField } from '@/components/common/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { LEGAL_PATHS } from '@/config/legal'
import { useAuth } from '@/features/auth/auth-context'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

const TOPICS: ContactTopic[] = ['partnership', 'support', 'privacy', 'other']

/**
 * Contact form → e-mail to the team (POST /contact). Used by /kontakt and the support
 * bubble; `compact` drops the optional fields. `idPrefix` keeps ids unique per instance.
 */
export function ContactForm({
  defaultTopic = 'other',
  compact,
  idPrefix = 'contact',
  firstFieldRef,
  onSent,
  sentAction,
}: {
  defaultTopic?: ContactTopic
  compact?: boolean
  idPrefix?: string
  /** Focused when the bubble opens. */
  firstFieldRef?: Ref<HTMLTextAreaElement>
  onSent?: () => void
  /** Button shown under the "sent" message (e.g. back home / close). */
  sentAction?: React.ReactNode
}) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    company: '',
    topic: defaultTopic,
    message: '',
    website: '',
  })
  const [error, setError] = useState<string | null>(null)
  const send = useMutation({ mutationFn: contactApi.send, onSuccess: () => onSent?.() })
  const id = (name: string) => `${idPrefix}-${name}`

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setError(null)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.name.trim().length < 2) return setError(t('contact.nameRequired'))
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError(t('contact.emailRequired'))
    if (form.message.trim().length < 10) return setError(t('contact.messageShort'))
    send.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: compact ? undefined : form.phone.trim() || undefined,
      company: compact ? undefined : form.company.trim() || undefined,
      topic: form.topic,
      message: form.message.trim(),
      website: form.website || undefined,
    })
  }

  if (send.isSuccess)
    return (
      <div role="status" className="space-y-3 py-4 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <p className="text-lg font-extrabold">{t('contact.sentTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('contact.sentText', { email: form.email.trim() })}</p>
        {sentAction}
      </div>
    )

  const message = (
    <FormField label={t('contact.message')} htmlFor={id('message')}>
      <Textarea ref={firstFieldRef} id={id('message')} value={form.message} onChange={set('message')} maxLength={3000} className={compact ? 'min-h-28' : 'min-h-36'} required />
    </FormField>
  )

  return (
    <form onSubmit={onSubmit} noValidate className={cn(compact ? 'space-y-3' : 'space-y-4')}>
      <FormField label={t('contact.topic')} htmlFor={id('topic')}>
        <NativeSelect id={id('topic')} value={form.topic} onChange={set('topic')}>
          {TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {t(`contact.topic.${topic}`)}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      {/* In the bubble the message comes first: it's what people open it for. */}
      {compact && message}
      <div className={cn('grid gap-3', !compact && 'gap-4 sm:grid-cols-2')}>
        <FormField label={t('contact.name')} htmlFor={id('name')}>
          <Input id={id('name')} value={form.name} onChange={set('name')} autoComplete="name" maxLength={80} required />
        </FormField>
        <FormField label={t('contact.email')} htmlFor={id('email')}>
          <Input id={id('email')} type="email" inputMode="email" value={form.email} onChange={set('email')} autoComplete="email" required />
        </FormField>
        {!compact && (
          <>
            <FormField label={t('contact.phone')} htmlFor={id('phone')}>
              <Input id={id('phone')} type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" maxLength={30} />
            </FormField>
            <FormField label={t('contact.company')} htmlFor={id('company')}>
              <Input id={id('company')} value={form.company} onChange={set('company')} autoComplete="organization" maxLength={120} />
            </FormField>
          </>
        )}
      </div>
      {!compact && message}
      {/* Honeypot: hidden from people, bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label htmlFor={id('website')}>Website</label>
        <input id={id('website')} tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t('contact.privacy')}{' '}
        <a href={LEGAL_PATHS.privacy} target="_blank" rel="noopener" className="font-semibold text-primary underline">
          {t('legal.privacy')}
        </a>
        .
      </p>
      {(error || send.isError) && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error ?? (send.error instanceof ApiError ? send.error.message : t('common.errorText'))}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={send.isPending}>
        {send.isPending ? <Loader2 className="animate-spin" /> : <Mail />}
        {t('contact.submit')}
      </Button>
    </form>
  )
}
