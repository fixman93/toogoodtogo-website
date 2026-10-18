import { useState } from 'react'
import { Loader2, UserPlus, Users } from 'lucide-react'
import { ApiError } from '@/api/client'
import type { Team } from '@/api/types'
import { ConfirmDelete } from '@/components/common/ConfirmDelete'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PartnerPageShell } from '@/features/business/PartnerPageShell'
import { useSaveTeamMember, useTeam } from '@/hooks/api'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

/** Location checkboxes; `value` = chosen location ids. */
function LocationPicker({ locations, value, onChange, disabled }: { locations: Team['locations']; value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {locations.map((l) => {
        const on = value.includes(l.id)
        return (
          <label
            key={l.id}
            className={cn('flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm', on ? 'border-primary bg-secondary font-semibold text-primary' : 'bg-card', disabled && 'opacity-60')}
          >
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              checked={on}
              disabled={disabled}
              onChange={(e) => onChange(e.target.checked ? [...value, l.id] : value.filter((id) => id !== l.id))}
            />
            {l.name}
          </label>
        )
      })}
    </div>
  )
}

function Member({ member, locations }: { member: Team['members'][number]; locations: Team['locations'] }) {
  const save = useSaveTeamMember()
  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="font-semibold">{member.name}</span> <span className="text-sm text-muted-foreground">{member.email}</span>
        </span>
        <ConfirmDelete
          label={t('staff.remove')}
          question={t('team.removeConfirm', { name: member.name })}
          onConfirm={() => save.mutate({ userId: member.id, businessIds: [] })}
          pending={save.isPending}
          error={null}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t('team.sees')}</p>
      <LocationPicker
        locations={locations}
        value={member.businessIds}
        disabled={save.isPending}
        // At least one location stays; removing all is the "Ukloni" button.
        onChange={(ids) => ids.length && save.mutate({ userId: member.id, businessIds: ids })}
      />
      {save.isError && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {save.error instanceof ApiError ? save.error.message : t('common.errorText')}
        </p>
      )}
    </li>
  )
}

function TeamManager() {
  const { data, isLoading, isError, refetch } = useTeam()
  const save = useSaveTeamMember()
  const [email, setEmail] = useState('')
  const [chosen, setChosen] = useState<string[] | null>(null)
  if (isLoading) return <Skeleton className="h-48 rounded-2xl" />
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />
  if (!data.locations.length) return <EmptyState icon={Users} title={t('business.empty')} />
  // New staff see all locations unless the owner unticks some.
  const businessIds = chosen ?? data.locations.map((l) => l.id)

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-4">
        <p className="font-bold">{t('team.addTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('staff.intro')}</p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate(
              { email: email.trim(), businessIds },
              {
                onSuccess: () => {
                  setEmail('')
                  setChosen(null)
                },
              },
            )
          }}
        >
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('staff.emailPlaceholder')} aria-label={t('staff.emailPlaceholder')} />
          <p className="text-xs font-semibold text-muted-foreground">{t('team.locations')}</p>
          <LocationPicker locations={data.locations} value={businessIds} onChange={setChosen} />
          <Button type="submit" disabled={!email.includes('@') || !businessIds.length || save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
            {t('staff.add')}
          </Button>
          {save.isError && (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {save.error instanceof ApiError ? save.error.message : t('common.errorText')}
            </p>
          )}
        </form>
      </Card>

      <section className="space-y-2">
        <h2 className="font-bold">{t('team.members', { count: data.members.length })}</h2>
        {data.members.length === 0 ? (
          <EmptyState icon={Users} title={t('staff.empty')} className="py-8" />
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y">
              {data.members.map((m) => (
                <Member key={m.id} member={m} locations={data.locations} />
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}

export function TeamPage() {
  return (
    <PartnerPageShell title={t('team.title')} intro={t('team.intro')}>
      <TeamManager />
    </PartnerPageShell>
  )
}
