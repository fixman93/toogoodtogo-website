import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Bell, ChevronRight, Cloud, Globe, Leaf, Loader2, LogOut, ShieldCheck, Store, Trash2, Wallet } from 'lucide-react'
import { ApiError } from '@/api/client'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/common/PageHeader'
import { RequireAuth } from '@/components/common/RequireAuth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { market } from '@/config/markets'
import { useAuth } from '@/features/auth/auth-context'
import { useDeleteAccount, useReservations } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDate, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Rough CO2e avoided per rescued bag (kg) — same estimate as the backend. */
const CO2E_KG_PER_BAG = 2.7
const co2Formatter = new Intl.NumberFormat(market.locale, { maximumFractionDigits: 1 })

function DeleteAccount() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const remove = useDeleteAccount()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  return (
    <section className="space-y-3">
      <h2 className="font-bold">{t('profile.privacy')}</h2>
      {!open ? (
        <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setOpen(true)}>
          <Trash2 />
          {t('profile.deleteAccount')}
        </Button>
      ) : (
        <Card className="space-y-3 border-destructive/30 p-4">
          <p className="text-sm">{t('profile.deleteAccountText')}</p>
          <Input type="password" autoComplete="current-password" placeholder={t('profile.deleteConfirmPassword')} value={password} onChange={(e) => setPassword(e.target.value)} />
          {remove.isError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {remove.error instanceof ApiError ? remove.error.message : t('common.errorText')}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              {t('partner.cancel')}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={!password || remove.isPending}
              onClick={() =>
                remove.mutate(password, {
                  onSuccess: () => {
                    logout()
                    navigate('/', { replace: true })
                  },
                })
              }
            >
              {remove.isPending && <Loader2 className="animate-spin" />}
              {t('profile.deleteConfirm')}
            </Button>
          </div>
        </Card>
      )}
    </section>
  )
}

function Impact() {
  const { data } = useReservations('history')
  const collected = data?.data.filter((r) => r.status === 'collected') ?? []
  const bags = collected.reduce((sum, r) => sum + r.quantity, 0)
  const saved = collected.reduce((sum, r) => sum + (r.originalUnitPriceMinor - r.unitPriceMinor) * r.quantity, 0)
  const co2Kg = bags * CO2E_KG_PER_BAG
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Card className="p-4">
        <Leaf className="mb-2 size-5 text-success" />
        <p className="text-2xl font-extrabold">{bags}</p>
        <p className="text-sm text-muted-foreground">{t('profile.bagsSaved')}</p>
      </Card>
      <Card className="p-4">
        <Wallet className="mb-2 size-5 text-accent-foreground" />
        <p className="text-2xl font-extrabold">{formatMoney(saved)}</p>
        <p className="text-sm text-muted-foreground">{t('profile.moneySaved')}</p>
      </Card>
      <Card className="col-span-2 p-4 sm:col-span-1" title={t('profile.co2Hint')}>
        <Cloud className="mb-2 size-5 text-primary" />
        <p className="text-2xl font-extrabold">{co2Formatter.format(co2Kg)} kg</p>
        <p className="text-sm text-muted-foreground">{t('profile.co2')}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t('profile.co2Hint')}</p>
      </Card>
    </div>
  )
}

function SettingRow({ icon: Icon, label, value, children }: { icon: typeof Globe; label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4">
      <Icon className="size-5 text-muted-foreground" />
      <span className="flex-1 font-medium">{label}</span>
      {value && <span className="text-sm text-muted-foreground">{value}</span>}
      {children}
    </div>
  )
}

function Profile() {
  const { user, logout, hasRole } = useAuth()
  const [notifications, setNotifications] = useState(() => localStorage.getItem('zalogaj.notifications') !== 'off')
  if (!user) return null
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="flex items-center gap-4 p-5">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-extrabold text-primary-foreground">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground">{t('profile.memberSince', { date: formatDate(user.createdAt) })}</p>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="font-bold">{t('profile.impact')}</h2>
        <Impact />
      </section>

      {hasRole('customer') && (
        <Link to="/partner/apply" className="flex min-h-14 items-center gap-3 rounded-2xl border border-dashed border-primary/40 px-4 py-3">
          <Store className="size-5 text-primary" />
          <span className="flex-1">
            <span className="block font-semibold">{t('profile.becomePartner')}</span>
            <span className="block text-sm text-muted-foreground">{t('profile.becomePartnerText')}</span>
          </span>
          <ChevronRight className="size-5" />
        </Link>
      )}

      {hasRole('business', 'admin') && (
        <Link to="/business" className="flex min-h-14 items-center gap-3 rounded-2xl bg-secondary px-4 font-semibold text-secondary-foreground">
          <Store className="size-5" />
          <span className="flex-1">{t('profile.businessPortal')}</span>
          <ChevronRight className="size-5" />
        </Link>
      )}
      {hasRole('admin') && (
        <Link to="/admin" className="flex min-h-14 items-center gap-3 rounded-2xl bg-accent/30 px-4 font-semibold text-accent-foreground">
          <ShieldCheck className="size-5" />
          <span className="flex-1">{t('admin.title')}</span>
          <ChevronRight className="size-5" />
        </Link>
      )}

      <section className="space-y-3">
        <h2 className="font-bold">{t('profile.settings')}</h2>
        <Card className="divide-y">
          <SettingRow icon={Globe} label={t('profile.language')} value="Srpski (latinica)" />
          <SettingRow icon={Globe} label={t('profile.country')} value={market.name} />
          <SettingRow icon={Wallet} label={t('profile.currency')} value={market.currency} />
          <SettingRow icon={Bell} label={t('profile.notifications')}>
            <button
              type="button"
              role="switch"
              aria-checked={notifications}
              aria-label={t('profile.notifications')}
              onClick={() => {
                localStorage.setItem('zalogaj.notifications', notifications ? 'off' : 'on')
                setNotifications(!notifications)
              }}
              className={cn('relative h-7 w-12 rounded-full transition-colors', notifications ? 'bg-primary' : 'bg-input')}
            >
              <span className={cn('absolute top-1 size-5 rounded-full bg-white shadow transition-all', notifications ? 'left-6' : 'left-1')} />
            </button>
          </SettingRow>
        </Card>
      </section>

      <div className="space-y-2">
        <Button variant="outline" className="w-full" onClick={logout}>
          <LogOut />
          {t('auth.logout')}
        </Button>
      </div>

      <DeleteAccount />
    </div>
  )
}

export function ProfilePage() {
  return (
    <div>
      <PageHeader title={t('profile.title')} />
      <RequireAuth>
        <Profile />
      </RequireAuth>
    </div>
  )
}
