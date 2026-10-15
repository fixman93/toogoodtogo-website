import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { CalendarCheck, Leaf, Loader2, MapPin, Search, ShoppingBag, Store, Users, type LucideIcon } from 'lucide-react'
import { ApiError } from '@/api/client'
import type { AdminBusiness, AdminUser, Role } from '@/api/types'
import { PageHeader } from '@/components/common/PageHeader'
import { SafeImage } from '@/components/common/SafeImage'
import { EmptyState, ErrorState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { RoleGuard } from '@/features/business/PartnerGuard'
import { useAdminBusinesses, useAdminStats, useAdminUsers, useSetBusinessActive, useSetUserRole } from '@/hooks/api'
import { t } from '@/i18n'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const TABS = ['overview', 'users', 'businesses'] as const
type Tab = (typeof TABS)[number]
const ROLES: Role[] = ['customer', 'business', 'admin']
const PAGE = 50
const ROLE_BADGE = { customer: 'muted', business: 'default', admin: 'accent' } as const

/** Text input that reports its value 300 ms after the user stops typing. */
function SearchBox({ placeholder, onSearch }: { placeholder: string; onSearch: (value: string) => void }) {
  const [value, setValue] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        className="rounded-full pl-12"
        onChange={(e) => {
          setValue(e.target.value)
          clearTimeout(timer.current)
          const next = e.target.value.trim()
          timer.current = setTimeout(() => onSearch(next), 300)
        }}
      />
    </div>
  )
}

function Chips<T extends string>({ value, onChange, options }: { value?: T; onChange: (v?: T) => void; options: { value?: T; label: string }[] }) {
  return (
    <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {options.map((o) => (
        <button
          key={o.value ?? 'all'}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors',
            value === o.value ? 'border-primary bg-secondary text-primary' : 'bg-card hover:bg-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overview

function StatTile({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: number; sub?: ReactNode }) {
  return (
    <Card className="p-4">
      <Icon className="mb-2 size-5 text-primary" />
      <p className="text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  )
}

function Overview() {
  const { data, isLoading, isError, refetch } = useAdminStats()
  if (isLoading)
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
    )
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile icon={Users} label={t('admin.stat.users')} value={data.users.total} />
      <StatTile icon={Users} label={t('admin.stat.customers')} value={data.users.customers} />
      <StatTile icon={Store} label={t('admin.stat.partners')} value={data.users.partners} sub={`${t('admin.stat.admins')}: ${data.users.admins}`} />
      <StatTile
        icon={MapPin}
        label={t('admin.stat.businesses')}
        value={data.businesses.total}
        sub={t('admin.stat.activeBusinesses', { count: data.businesses.active })}
      />
      <StatTile icon={ShoppingBag} label={t('admin.stat.liveOffers')} value={data.offers.live} />
      <StatTile icon={CalendarCheck} label={t('admin.stat.reservationsToday')} value={data.reservations.today} />
      <StatTile icon={CalendarCheck} label={t('admin.stat.upcoming')} value={data.reservations.upcoming} />
      <StatTile icon={Leaf} label={t('admin.stat.collected')} value={data.reservations.collected} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Users

function UserRow({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const setRole = useSetUserRole()
  const [role, setLocalRole] = useState<Role>(user.role)
  const [saved, setSaved] = useState<string | null>(null)
  const changed = role !== user.role
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')

  return (
    <li className="space-y-3 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-secondary-foreground">{initials}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold">
            <span className="truncate">{user.name}</span>
            <Badge variant={ROLE_BADGE[user.role]}>{t(`admin.role.${user.role}`)}</Badge>
          </p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground">
            {t('profile.memberSince', { date: formatDate(user.createdAt) })}
            {user.businessCount > 0 && ` · ${t('admin.locations', { count: user.businessCount })}`}
          </p>
        </div>
      </div>

      {isSelf ? (
        <p className="text-xs font-medium text-muted-foreground">{t('admin.you')}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`role-${user.id}`}>
            {t('admin.changeRole')}
          </label>
          <NativeSelect
            id={`role-${user.id}`}
            value={role}
            onChange={(e) => {
              setLocalRole(e.target.value as Role)
              setSaved(null)
            }}
            className="h-10 w-40 rounded-full"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`admin.role.${r}`)}
              </option>
            ))}
          </NativeSelect>
          {changed && (
            <Button
              size="sm"
              disabled={setRole.isPending}
              onClick={() =>
                setRole.mutate(
                  { id: user.id, role },
                  { onSuccess: (u) => setSaved(t('admin.roleSaved', { name: u.name, role: t(`admin.role.${u.role}`) })) },
                )
              }
            >
              {setRole.isPending && <Loader2 className="animate-spin" />}
              {t('admin.saveRole')}
            </Button>
          )}
        </div>
      )}

      {changed && role === 'business' && <p className="text-xs text-muted-foreground">{t('admin.promoteHint')}</p>}
      {changed && user.role === 'business' && user.businessCount > 0 && <p className="text-xs font-medium text-accent-foreground">{t('admin.demoteWarning')}</p>}
      {saved && <p role="status" className="text-xs font-semibold text-success">{saved}</p>}
      {setRole.isError && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {setRole.error instanceof ApiError ? setRole.error.message : t('common.errorText')}
        </p>
      )}
    </li>
  )
}

function UsersTab() {
  const { user: me } = useAuth()
  const [q, setQ] = useState('')
  const [role, setRole] = useState<Role>()
  const [limit, setLimit] = useState(PAGE)
  const { data, isLoading, isError, refetch, isFetching } = useAdminUsers({ q: q || undefined, role, limit })

  return (
    <div className="space-y-4">
      <SearchBox
        placeholder={t('admin.searchUsers')}
        onSearch={(v) => {
          setQ(v)
          setLimit(PAGE)
        }}
      />
      <Chips<Role>
        value={role}
        onChange={(v) => {
          setRole(v)
          setLimit(PAGE)
        }}
        options={[{ label: t('admin.all') }, ...ROLES.map((r) => ({ value: r, label: t(`admin.role.${r}`) }))]}
      />
      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data?.data.length ? (
        <EmptyState icon={Users} title={t('admin.noResults')} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t('admin.stat.users')}: {data.meta.total}
          </p>
          <Card className={cn('overflow-hidden', isFetching && 'opacity-70')}>
            <ul className="divide-y">
              {data.data.map((u) => (
                <UserRow key={u.id} user={u} isSelf={u.id === me?.id} />
              ))}
            </ul>
          </Card>
          {data.data.length < data.meta.total && (
            <Button variant="outline" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>
              {t('admin.showMore')}
            </Button>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Businesses

function BusinessRow({ business: b }: { business: AdminBusiness }) {
  const toggle = useSetBusinessActive()
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <SafeImage src={b.logoUrl} alt="" className="size-11 shrink-0 rounded-full" />
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <span className="truncate">{b.name}</span>
            <Badge variant={b.isActive ? 'success' : 'muted'}>{b.isActive ? t('partner.locationActive') : t('partner.locationInactive')}</Badge>
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {b.address.street}, {b.address.city} · {t(`category.${b.category}`)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {t('admin.owner')}: {b.owner ? `${b.owner.name} (${b.owner.email})` : '—'} · {t('admin.liveOffers', { count: b.liveOfferCount })}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant={b.isActive ? 'outline' : 'default'}
        disabled={toggle.isPending}
        onClick={() => toggle.mutate({ id: b.id, isActive: !b.isActive })}
        className="self-start sm:self-center"
      >
        {toggle.isPending && <Loader2 className="animate-spin" />}
        {b.isActive ? t('admin.deactivate') : t('admin.activate')}
      </Button>
    </li>
  )
}

function BusinessesTab() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>()
  const [limit, setLimit] = useState(PAGE)
  const { data, isLoading, isError, refetch, isFetching } = useAdminBusinesses({ q: q || undefined, status, limit })

  return (
    <div className="space-y-4">
      <SearchBox
        placeholder={t('admin.searchBusinesses')}
        onSearch={(v) => {
          setQ(v)
          setLimit(PAGE)
        }}
      />
      <Chips<'active' | 'inactive'>
        value={status}
        onChange={(v) => {
          setStatus(v)
          setLimit(PAGE)
        }}
        options={[
          { label: t('admin.allBusinesses') },
          { value: 'active', label: t('admin.activeOnly') },
          { value: 'inactive', label: t('admin.inactiveOnly') },
        ]}
      />
      <p className="text-xs text-muted-foreground">{t('admin.deactivateHint')}</p>
      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data?.data.length ? (
        <EmptyState icon={Store} title={t('admin.noResults')} />
      ) : (
        <>
          <Card className={cn('overflow-hidden', isFetching && 'opacity-70')}>
            <ul className="divide-y">
              {data.data.map((b) => (
                <BusinessRow key={b.id} business={b} />
              ))}
            </ul>
          </Card>
          {data.data.length < data.meta.total && (
            <Button variant="outline" className="w-full" onClick={() => setLimit((l) => l + PAGE)}>
              {t('admin.showMore')}
            </Button>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function AdminPanel() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? (params.get('tab') as Tab) : 'overview'

  return (
    <div className="space-y-5">
      <div role="tablist" className="inline-flex rounded-full bg-muted p-1">
        {TABS.map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setParams(id === 'overview' ? {} : { tab: id }, { replace: true })}
            className={cn(
              'h-10 rounded-full px-4 text-sm font-semibold transition-all sm:px-5',
              tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {t(`admin.tab.${id}`)}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'users' && <UsersTab />}
      {tab === 'businesses' && <BusinessesTab />}
    </div>
  )
}

export function AdminPage() {
  return (
    <div>
      <PageHeader title={t('admin.title')} subtitle={t('admin.intro')} />
      <RoleGuard roles={['admin']} deniedText={t('admin.noAccess')}>
        <AdminPanel />
      </RoleGuard>
    </div>
  )
}
