import { useState } from 'react'
import { Link } from 'react-router'
import { Bell, ChevronRight, Globe, Leaf, LogOut, Store, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { RequireAuth } from '@/components/common/RequireAuth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { market } from '@/config/markets'
import { useAuth } from '@/features/auth/auth-context'
import { useReservations } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDate, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

function Impact() {
  const { data } = useReservations('history')
  const collected = data?.data.filter((r) => r.status === 'collected') ?? []
  const bags = collected.reduce((sum, r) => sum + r.quantity, 0)
  const saved = collected.reduce((sum, r) => sum + (r.originalUnitPriceMinor - r.unitPriceMinor) * r.quantity, 0)
  return (
    <div className="grid grid-cols-2 gap-3">
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

      {hasRole('business', 'admin') && (
        <Link to="/business" className="flex min-h-14 items-center gap-3 rounded-2xl bg-secondary px-4 font-semibold text-secondary-foreground">
          <Store className="size-5" />
          <span className="flex-1">{t('profile.businessPortal')}</span>
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
