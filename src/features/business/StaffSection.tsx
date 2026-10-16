import { useState } from 'react'
import { ChevronDown, Loader2, UserPlus, Users } from 'lucide-react'
import { ApiError } from '@/api/client'
import { ConfirmDelete } from '@/components/common/ConfirmDelete'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAddStaff, useRemoveStaff, useStaff } from '@/hooks/api'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

/** Collapsible "Zaposleni" block on a location card (owner only). */
export function StaffSection({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const staff = useStaff(businessId, open)
  const add = useAddStaff(businessId)
  const remove = useRemoveStaff(businessId)

  return (
    <div className="border-t">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between px-4 text-sm font-semibold text-muted-foreground hover:bg-muted/50"
      >
        <span className="flex items-center gap-2">
          <Users className="size-4" />
          {t('staff.title')}
          {staff.data && ` (${staff.data.length})`}
        </span>
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-3 border-t px-4 py-3">
          <p className="text-xs text-muted-foreground">{t('staff.intro')}</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              add.mutate(email.trim(), { onSuccess: () => setEmail('') })
            }}
          >
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('staff.emailPlaceholder')} />
            <Button type="submit" size="sm" className="h-11" disabled={!email.includes('@') || add.isPending}>
              {add.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
              {t('staff.add')}
            </Button>
          </form>
          {add.isError && <p className="text-xs font-semibold text-destructive">{add.error instanceof ApiError ? add.error.message : t('common.errorText')}</p>}
          {!staff.data?.length ? (
            <p className="text-sm text-muted-foreground">{t('staff.empty')}</p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {staff.data.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    <span className="font-semibold">{s.name}</span> <span className="text-muted-foreground">{s.email}</span>
                  </span>
                  <ConfirmDelete label={t('staff.remove')} question={`${t('staff.remove')} ${s.name}?`} onConfirm={() => remove.mutate(s.id)} pending={remove.isPending} error={remove.error} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
