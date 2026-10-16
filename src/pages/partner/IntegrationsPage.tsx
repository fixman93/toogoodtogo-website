import { useState } from 'react'
import { KeyRound, Loader2, Webhook } from 'lucide-react'
import { ApiError } from '@/api/client'
import { ConfirmDelete } from '@/components/common/ConfirmDelete'
import { FormSection } from '@/components/common/FormField'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PartnerPageShell } from '@/features/business/PartnerPageShell'
import { useApiKeys, useCreateApiKey, useCreateWebhook, useDeleteWebhook, useRevokeApiKey, useTestWebhook, useWebhooks } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDayLabel, formatTime } from '@/lib/format'

function Secret({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-xl border border-warning/50 bg-warning/10 p-3">
      <p className="text-xs font-semibold">{label}</p>
      <input readOnly value={value} onFocus={(e) => e.target.select()} className="w-full rounded-lg border bg-card px-3 py-2 font-mono text-xs" aria-label={label} />
    </div>
  )
}

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : t('common.errorText'))

function ApiKeys() {
  const keys = useApiKeys()
  const create = useCreateApiKey()
  const revoke = useRevokeApiKey()
  const [name, setName] = useState('')
  return (
    <FormSection title={t('integrations.keys')}>
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('integrations.keyName')} />
        <Button disabled={name.trim().length < 2 || create.isPending} onClick={() => create.mutate(name.trim(), { onSuccess: () => setName('') })}>
          {create.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
          {t('integrations.createKey')}
        </Button>
      </div>
      {create.data?.key && <Secret label={t('integrations.keyOnce')} value={create.data.key} />}
      {create.isError && <p className="text-sm text-destructive">{errorText(create.error)}</p>}
      {keys.isLoading ? (
        <Skeleton className="h-16" />
      ) : !keys.data?.length ? (
        <p className="text-sm text-muted-foreground">{t('integrations.empty')}</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {keys.data.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span>
                <span className="font-semibold">{k.name}</span> <span className="font-mono text-muted-foreground">{k.prefix}…</span>
                <span className="block text-xs text-muted-foreground">
                  {k.lastUsedAt ? t('integrations.lastUsed', { when: `${formatDayLabel(k.lastUsedAt)} ${formatTime(k.lastUsedAt)}` }) : t('integrations.neverUsed')}
                </span>
              </span>
              <ConfirmDelete label={t('integrations.revoke')} question={`${t('integrations.revoke')} „${k.name}"?`} onConfirm={() => revoke.mutate(k.id)} pending={revoke.isPending} error={revoke.error} />
            </li>
          ))}
        </ul>
      )}
    </FormSection>
  )
}

function Webhooks() {
  const hooks = useWebhooks()
  const create = useCreateWebhook()
  const remove = useDeleteWebhook()
  const test = useTestWebhook()
  const [url, setUrl] = useState('')
  return (
    <FormSection title={t('integrations.webhooks')}>
      <div className="flex gap-2">
        <Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t('integrations.webhookUrl')} />
        <Button disabled={!url.trim() || create.isPending} onClick={() => create.mutate({ url: url.trim() }, { onSuccess: () => setUrl('') })}>
          {create.isPending ? <Loader2 className="animate-spin" /> : <Webhook />}
          {t('integrations.addWebhook')}
        </Button>
      </div>
      {create.data?.secret && <Secret label={t('integrations.secretOnce')} value={create.data.secret} />}
      {create.isError && <p className="text-sm text-destructive">{errorText(create.error)}</p>}
      {hooks.isLoading ? (
        <Skeleton className="h-16" />
      ) : !hooks.data?.length ? (
        <p className="text-sm text-muted-foreground">{t('integrations.empty')}</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {hooks.data.map((h) => (
            <li key={h.id} className="space-y-2 p-3 text-sm">
              <p className="font-mono text-xs break-all">{h.url}</p>
              <p className="flex flex-wrap gap-1">
                {h.events.map((e) => (
                  <Badge key={e} variant="secondary">
                    {e}
                  </Badge>
                ))}
                {h.lastStatus != null && <Badge variant={h.lastStatus >= 200 && h.lastStatus < 300 ? 'success' : 'destructive'}>{t('integrations.testResult', { status: h.lastStatus || 'error' })}</Badge>}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={test.isPending} onClick={() => test.mutate(h.id)}>
                  {t('integrations.test')}
                </Button>
                <ConfirmDelete label={t('partner.deleteShort')} question={`${t('partner.deleteShort')} webhook?`} onConfirm={() => remove.mutate(h.id)} pending={remove.isPending} error={remove.error} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </FormSection>
  )
}

export function IntegrationsPage() {
  return (
    <PartnerPageShell title={t('integrations.title')} intro={t('integrations.intro')}>
      <div className="mx-auto max-w-2xl space-y-5">
        <p className="rounded-xl bg-muted p-3 font-mono text-xs">{t('integrations.docs')}</p>
        <ApiKeys />
        <Webhooks />
      </div>
    </PartnerPageShell>
  )
}
