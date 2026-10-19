import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { AlertTriangle, Ban, MapPinCheck, CalendarCheck, ScanLine, ShieldCheck, CheckCircle2, ChevronDown, ClipboardList, History, Leaf, Loader2, MapPin, MessageSquare, PauseCircle, PlayCircle, ReceiptText, Search, ShoppingBag, Store, Users, type LucideIcon } from 'lucide-react'
import { ApiError } from '@/api/client'
import { PLATFORM_ROLES, type AdminBusiness, type AdminReview, type AdminUser, type ApplicationStatus, type PartnerApplication, type Permission, type PaymentDirection, type PaymentMethod, type PlatformStatementPartner, type Reservation, type ReservationStatus, type Role, type TicketStatus } from '@/api/types'
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
import { Stars } from '@/components/offers/ReviewList'
import { StatusBadge } from '@/components/reservations/StatusBadge'
import { Textarea } from '@/components/ui/textarea'
import {
  useAdminApplications,
  useAdminBusinesses,
  useAdminReservations,
  useAdminReviews,
  useAdminStats,
  useAdminUsers,
  useAdminTickets,
  useAuditLog,
  useDonations,
  usePlatformStatement,
  useOutstanding,
  useRecordPayment,
  useDeletePayment,
  usePartnerStanding,
  usePartnerModeration,
  usePlatformIntegrity,
  useDisputes,
  useIntegrityAlerts,
  useResolveDispute,
  useStaffAccess,
  useSetStaffAccess,
  useSetCommission,
  useTicket,
  useDecideApplication,
  useSetBusinessActive,
  useSetReviewHidden,
  useSetUserBlocked,
  useSetUserRole,
} from '@/hooks/api'
import { t } from '@/i18n'
import { formatDate, formatDayLabel, formatMoney, formatPickupWindow, formatTime, fromMinor, toMinor } from '@/lib/format'
import { currentMonth } from '@/lib/time'
import { TicketStatusBadge, TicketThread } from '@/features/support/TicketThread'
import { PromotionsManager } from '@/features/promotions/PromotionsManager'
import { DonationTable } from '@/pages/partner/DonationsPage'
import { OpenMonths, SettlementInfo, StatementSummary } from '@/pages/partner/StatementPage'
import { ConfirmDelete } from '@/components/common/ConfirmDelete'
import { NoteItem } from '@/features/business/StandingNotice'
import { cn } from '@/lib/utils'
import { MARKETS } from '@/config/markets'

const TABS = ['overview', 'applications', 'users', 'partners', 'businesses', 'reservations', 'reviews', 'support', 'promotions', 'finance', 'integrity', 'donations', 'audit'] as const
type Tab = (typeof TABS)[number]
/** Which permission each tab needs (mirrors the API). */
const TAB_PERMISSION: Record<Tab, Permission> = {
  overview: 'stats.view',
  applications: 'applications.manage',
  users: 'users.view',
  partners: 'partners.manage',
  businesses: 'businesses.moderate',
  reservations: 'reservations.view',
  reviews: 'reviews.moderate',
  support: 'support.manage',
  promotions: 'promotions.manage',
  finance: 'finance.view',
  integrity: 'integrity.view',
  donations: 'donations.view',
  audit: 'audit.view',
}
const ROLES: Role[] = ['customer', 'business', 'staff', 'admin', 'operations', 'support', 'finance']
const PAGE = 50
const ROLE_BADGE = { customer: 'muted', business: 'default', staff: 'secondary', admin: 'accent', operations: 'accent', support: 'accent', finance: 'accent' } as const

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

function StatTile({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: number | string; sub?: ReactNode }) {
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

/** Staff = chosen locations of ONE partner: pick the partner, tick locations, save. */
function StaffAccessEditor({ user, onDone }: { user: AdminUser; onDone?: () => void }) {
  const current = useStaffAccess(user.id)
  const all = useAdminBusinesses({ limit: 100 })
  const save = useSetStaffAccess()
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [ids, setIds] = useState<string[] | null>(null)
  const businesses = all.data?.data ?? []
  const owners = [...new Map(businesses.filter((b) => b.owner).map((b) => [b.owner!.id, b.owner!])).values()]
  const owner = ownerId ?? current.data?.ownerId ?? ''
  const chosen = ids ?? current.data?.businessIds ?? []
  const locations = businesses.filter((b) => b.owner?.id === owner)

  if (current.isLoading || all.isLoading) return <Skeleton className="h-20 rounded-xl" />
  return (
    <div className="space-y-2 rounded-xl border bg-muted/30 p-3 text-sm">
      <p className="font-semibold">{t('team.adminTitle')}</p>
      <NativeSelect
        value={owner}
        onChange={(e) => {
          setOwnerId(e.target.value)
          setIds([])
        }}
        className="h-10 rounded-lg"
        aria-label={t('team.partner')}
      >
        <option value="">{t('team.choosePartner')}</option>
        {owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.email})
          </option>
        ))}
      </NativeSelect>
      {owner && (
        <div className="flex flex-wrap gap-2">
          {locations.map((b) => (
            <label key={b.id} className="flex min-h-9 items-center gap-2 rounded-full border bg-card px-3">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={chosen.includes(b.id)}
                onChange={(e) => setIds(e.target.checked ? [...chosen, b.id] : chosen.filter((x) => x !== b.id))}
              />
              {b.name}
            </label>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!chosen.length || save.isPending} onClick={() => save.mutate({ userId: user.id, businessIds: chosen }, { onSuccess: onDone })}>
          {save.isPending && <Loader2 className="animate-spin" />}
          {t('team.saveAccess')}
        </Button>
        {user.role === 'staff' && (
          <Button size="sm" variant="ghost" className="text-destructive" disabled={save.isPending} onClick={() => save.mutate({ userId: user.id, businessIds: [] }, { onSuccess: onDone })}>
            {t('team.removeAccess')}
          </Button>
        )}
      </div>
      {save.isError && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {save.error instanceof ApiError ? save.error.message : t('common.errorText')}
        </p>
      )}
    </div>
  )
}

function UserRow({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  const { can } = useAuth()
  const canRoles = can('users.roles')
  const setRole = useSetUserRole()
  const block = useSetUserBlocked()
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
            {user.isBlocked && <Badge variant="destructive">{t('admin.blocked')}</Badge>}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {user.email}
            {user.phone && ` · ${user.phone}`}
          </p>
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
            disabled={!canRoles}
            title={canRoles ? undefined : t('admin.rolesSuperOnly')}
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
          {can('users.block') && !PLATFORM_ROLES.includes(user.role) && !changed && (
            <Button
              size="sm"
              variant={user.isBlocked ? 'secondary' : 'ghost'}
              className={user.isBlocked ? '' : 'text-destructive hover:bg-destructive/10'}
              disabled={block.isPending}
              onClick={() => block.mutate({ id: user.id, blocked: !user.isBlocked })}
            >
              <Ban />
              {user.isBlocked ? t('admin.unblock') : t('admin.block')}
            </Button>
          )}
          {changed && role !== 'staff' && (
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
      {canRoles && !isSelf && ((changed && role === 'staff') || (!changed && user.role === 'staff')) && (
        <StaffAccessEditor user={user} onDone={() => setLocalRole(user.role === 'staff' ? 'staff' : role)} />
      )}
      {changed && user.role === 'business' && user.businessCount > 0 && <p className="text-xs font-medium text-accent-foreground">{t('admin.demoteWarning')}</p>}
      {saved && <p role="status" className="text-xs font-semibold text-success">{saved}</p>}
      {block.isError && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {block.error instanceof ApiError ? block.error.message : t('common.errorText')}
        </p>
      )}
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
// Partner applications

function ApplicationRow({ a }: { a: PartnerApplication }) {
  const decide = useDecideApplication()
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  return (
    <li className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{a.businessName}</p>
          <p className="text-sm text-muted-foreground">
            {t(`category.${a.category}`)} · {a.city}{a.countryCode && MARKETS[a.countryCode] ? `, ${MARKETS[a.countryCode].name}` : ''} · {t('admin.locations', { count: a.locationsCount })}
          </p>
          <p className="text-sm">
            {a.contactName} · {a.phone} · <span className="text-muted-foreground">{a.user?.email}</span>
          </p>
          {a.message && <p className="mt-1 rounded-lg bg-muted p-2 text-sm">{a.message}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{formatDate(a.createdAt)}</p>
        </div>
        <Badge variant={a.status === 'pending' ? 'accent' : a.status === 'approved' ? 'success' : 'destructive'}>{t(`admin.application.${a.status}`)}</Badge>
      </div>
      {a.status === 'pending' &&
        (rejecting ? (
          <div className="space-y-2">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('admin.rejectNote')} className="min-h-16" maxLength={500} />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setRejecting(false)}>
                {t('partner.cancel')}
              </Button>
              <Button size="sm" variant="destructive" disabled={decide.isPending} onClick={() => decide.mutate({ id: a.id, status: 'rejected', note: note.trim() || undefined })}>
                {t('admin.reject')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: a.id, status: 'approved' })}>
              {decide.isPending && <Loader2 className="animate-spin" />}
              {t('admin.approve')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRejecting(true)}>
              {t('admin.reject')}
            </Button>
          </div>
        ))}
      {a.reviewNote && a.status !== 'pending' && <p className="text-xs text-muted-foreground">{a.reviewNote}</p>}
    </li>
  )
}

function ApplicationsTab() {
  const [status, setStatus] = useState<ApplicationStatus | undefined>('pending')
  const { data, isLoading, isError, refetch } = useAdminApplications(status)
  return (
    <div className="space-y-4">
      <Chips<ApplicationStatus>
        value={status}
        onChange={setStatus}
        options={[
          { value: 'pending', label: t('admin.application.pending') },
          { value: 'approved', label: t('admin.application.approved') },
          { value: 'rejected', label: t('admin.application.rejected') },
          { label: t('admin.all') },
        ]}
      />
      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data?.data.length ? (
        <EmptyState icon={Store} title={t('admin.noResults')} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y">
            {data.data.map((a) => (
              <ApplicationRow key={a.id} a={a} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// All reservations

const RES_STATUSES: ReservationStatus[] = ['confirmed', 'collected', 'cancelled', 'expired']

function ReservationsTab() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ReservationStatus>()
  const [limit, setLimit] = useState(PAGE)
  const { data, isLoading, isError, refetch } = useAdminReservations({ q: q || undefined, status, limit })
  return (
    <div className="space-y-4">
      <SearchBox placeholder={t('admin.searchReservations')} onSearch={setQ} />
      <Chips<ReservationStatus> value={status} onChange={setStatus} options={[{ label: t('admin.all') }, ...RES_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))]} />
      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data?.data.length ? (
        <EmptyState icon={ClipboardList} title={t('admin.noResults')} />
      ) : (
        <>
          <Card className="overflow-hidden">
            <ul className="divide-y">
              {data.data.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-semibold">
                      <span className="font-mono text-primary">{r.code}</span> · {r.business.name}
                    </p>
                    <p className="truncate text-muted-foreground">
                      {r.quantity} × {r.offer.title} · {formatMoney(r.totalMinor, r.currency)}
                    </p>
                    <p className="text-muted-foreground">
                      {t('admin.customer')}: {r.customer?.name ?? '—'} · {formatPickupWindow(r.pickupStart, r.pickupEnd, r.timezone)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
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
// Review moderation

function ReviewRow({ r }: { r: AdminReview }) {
  const toggle = useSetReviewHidden()
  return (
    <li className={cn('space-y-1.5 p-4', r.isHidden && 'opacity-70')}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Stars value={r.rating} />
          {r.isHidden && <Badge variant="muted">{t('admin.hidden')}</Badge>}
        </div>
        <Button size="sm" variant={r.isHidden ? 'secondary' : 'ghost'} disabled={toggle.isPending} onClick={() => toggle.mutate({ id: r.id, hidden: !r.isHidden })}>
          {r.isHidden ? t('admin.showReview') : t('admin.hideReview')}
        </Button>
      </div>
      {r.comment && <p className="text-sm">{r.comment}</p>}
      <p className="text-xs text-muted-foreground">
        {r.user?.name} ({r.user?.email}) → {r.business?.name} · {formatDate(r.createdAt)}
      </p>
    </li>
  )
}

function ReviewsTab() {
  const [hidden, setHidden] = useState<'hidden' | 'visible'>()
  const { data, isLoading, isError, refetch } = useAdminReviews({ hidden: hidden == null ? undefined : hidden === 'hidden', limit: 100 })
  return (
    <div className="space-y-4">
      <Chips<'hidden' | 'visible'>
        value={hidden}
        onChange={setHidden}
        options={[{ label: t('admin.all') }, { value: 'visible', label: t('admin.showReview') }, { value: 'hidden', label: t('admin.hidden') }]}
      />
      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data?.data.length ? (
        <EmptyState icon={MessageSquare} title={t('admin.noResults')} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y">
            {data.data.map((r) => (
              <ReviewRow key={r.id} r={r} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Audit log

function AuditTab() {
  const { data, isLoading, isError, refetch } = useAuditLog()
  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />
  if (isError) return <ErrorState onRetry={() => refetch()} />
  if (!data?.data.length) return <EmptyState icon={History} title={t('admin.noResults')} />
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y">
        {data.data.map((e) => (
          <li key={e.id} className="p-4 text-sm">
            <p className="font-medium">{e.summary}</p>
            <p className="text-xs text-muted-foreground">
              {e.actor ? `${e.actor.name} (${e.actor.email})` : '—'} · {formatDayLabel(e.createdAt)} {formatTime(e.createdAt)} · <code>{e.action}</code>
            </p>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Support tickets

function TicketDetails({ id }: { id: string }) {
  const { data, isLoading } = useTicket(id)
  if (isLoading || !data) return <Skeleton className="h-32" />
  return <TicketThread ticket={data} asTeam />
}

function SupportTab() {
  const [status, setStatus] = useState<TicketStatus | undefined>('open')
  const [openId, setOpenId] = useState<string>()
  const { data, isLoading, isError, refetch } = useAdminTickets(status)
  return (
    <div className="space-y-4">
      <Chips<TicketStatus>
        value={status}
        onChange={setStatus}
        options={[
          { value: 'open', label: t('support.status.open') },
          { value: 'answered', label: t('support.status.answered') },
          { value: 'closed', label: t('support.status.closed') },
          { label: t('admin.all') },
        ]}
      />
      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data?.data.length ? (
        <EmptyState icon={MessageSquare} title={t('admin.noResults')} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y">
            {data.data.map((ticket) => (
              <li key={ticket.id} className="space-y-3 p-4">
                <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpenId(openId === ticket.id ? undefined : ticket.id)}>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{ticket.subject}</span>
                    <span className="block text-xs text-muted-foreground">
                      {ticket.user?.name} · {t(`support.category.${ticket.category}`)} · {formatDayLabel(ticket.lastMessageAt)} {formatTime(ticket.lastMessageAt)}
                    </span>
                  </span>
                  <TicketStatusBadge status={ticket.status} />
                </button>
                {openId === ticket.id && <TicketDetails id={ticket.id} />}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Finance: monthly platform statement + commission overrides

function CommissionEditor({ businessId, rate }: { businessId: string; rate: number }) {
  const set = useSetCommission()
  const [value, setValue] = useState(String(Math.round(rate * 1000) / 10))
  return (
    <span className="flex items-center gap-1.5">
      <Input type="number" min={0} max={50} step={0.5} value={value} onChange={(e) => setValue(e.target.value)} className="h-8 w-20 rounded-lg px-2 text-sm" aria-label={t('admin.commission')} />
      <span className="text-xs">%</span>
      <Button size="sm" variant="outline" className="h-8" disabled={set.isPending} onClick={() => set.mutate({ businessId, rate: Number(value) / 100 })}>
        {t('admin.setCommission')}
      </Button>
    </span>
  )
}

const todayIso = () => new Date().toLocaleDateString('en-CA')

/** Confirm a payment for one partner and month (pre-filled with what is still open). */
function PaymentForm({ partner, month, onDone }: { partner: PlatformStatementPartner; month: string; onDone: () => void }) {
  const record = useRecordPayment()
  const currency = partner.currency
  const [direction, setDirection] = useState<PaymentDirection>(partner.remainingMinor < 0 ? 'to_partner' : 'to_platform')
  const [amount, setAmount] = useState(partner.remainingMinor ? String(fromMinor(Math.abs(partner.remainingMinor), currency)) : '')
  const [method, setMethod] = useState<PaymentMethod>('bank')
  const [paidAt, setPaidAt] = useState(todayIso())
  const [note, setNote] = useState('')
  const [invalid, setInvalid] = useState(false)

  return (
    <form
      className="space-y-3 rounded-xl border bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault()
        const amountMinor = toMinor(Number(amount.replace(',', '.')), currency)
        if (!Number.isFinite(amountMinor) || amountMinor <= 0) return setInvalid(true)
        setInvalid(false)
        record.mutate({ ownerId: partner.ownerId, month, amountMinor, direction, method, paidAt, note: note.trim() || undefined }, { onSuccess: onDone })
      }}
    >
      <NativeSelect value={direction} onChange={(e) => setDirection(e.target.value as PaymentDirection)} className="h-10 w-full rounded-lg" aria-label={t('settle.direction.to_platform')}>
        <option value="to_platform">{t('settle.direction.to_platform')}</option>
        <option value="to_partner">{t('settle.direction.to_partner')}</option>
      </NativeSelect>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs font-semibold">
          {t('settle.amount', { currency })}
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 rounded-lg" required />
        </label>
        <label className="space-y-1 text-xs font-semibold">
          {t('settle.method')}
          <NativeSelect value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="h-10 w-full rounded-lg">
            {(['bank', 'cash', 'other'] as const).map((m) => (
              <option key={m} value={m}>
                {t(`settle.method.${m}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1 text-xs font-semibold">
          {t('settle.date')}
          <Input type="date" value={paidAt} max={todayIso()} onChange={(e) => setPaidAt(e.target.value)} className="h-10 rounded-lg" required />
        </label>
      </div>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('settle.note')} maxLength={300} className="h-10 rounded-lg" />
      {(invalid || record.isError) && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {invalid ? t('settle.invalidAmount') : record.error instanceof ApiError ? record.error.message : t('common.errorText')}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={record.isPending}>
          {record.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          {t('settle.save')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          {t('settle.cancel')}
        </Button>
      </div>
    </form>
  )
}

function FinancePartnerRow({ p, month }: { p: PlatformStatementPartner; month: string }) {
  const { can } = useAuth()
  const currency = p.currency
  const manage = can('finance.manage')
  const remove = useDeletePayment()
  const [paying, setPaying] = useState(false)
  const [details, setDetails] = useState(false)

  return (
    <li className="space-y-3 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2 font-semibold">
            {p.name}
            {p.partnerStatus !== 'active' && <Badge variant="destructive">{t(`pm.status.${p.partnerStatus}`)}</Badge>}
          </span>
          <span className="block truncate text-muted-foreground">{p.email}</span>
        </span>
        <span className="text-right">
          <span className="block font-bold tabular-nums">
            {p.balanceMinor >= 0 ? t('statement.balance') : t('statement.balanceCredit')}: {formatMoney(Math.abs(p.balanceMinor), currency)}
          </span>
          <span className="text-xs text-muted-foreground">
            {t('statement.ordersCount', { count: p.orders })} · {formatMoney(p.grossMinor, currency)}
          </span>
        </span>
      </div>

      <SettlementInfo
        s={p}
        payments={p.payments}
        currency={currency}
        paymentAction={
          manage
            ? (pay) => (
                <ConfirmDelete
                  label={t('settle.undo')}
                  question={t('settle.undoConfirm', { amount: formatMoney(pay.amountMinor, currency) })}
                  onConfirm={() => remove.mutate(pay.id)}
                  pending={remove.isPending}
                  error={remove.error}
                />
              )
            : undefined
        }
      />

      {paying ? (
        <PaymentForm partner={p} month={month} onDone={() => setPaying(false)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {manage && p.status !== 'paid' && p.status !== 'none' && (
            <Button size="sm" onClick={() => setPaying(true)}>
              <CheckCircle2 />
              {p.remainingMinor < 0 ? t('settle.recordPayout') : t('settle.record')}
            </Button>
          )}
          <Button size="sm" variant="ghost" aria-expanded={details} onClick={() => setDetails((v) => !v)}>
            {t('admin.locations', { count: p.businesses.length })}
            <ChevronDown className={cn('transition-transform', details && 'rotate-180')} />
          </Button>
        </div>
      )}

      {details && (
        <ul className="space-y-1.5">
          {p.businesses.map((b) => (
            <li key={b.businessId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <span>
                {b.name} · {b.orders} · {formatMoney(b.grossMinor, currency)} · {formatMoney(b.commissionMinor, currency)}
              </span>
              <CommissionEditor businessId={b.businessId} rate={b.rate} />
            </li>
          ))}
          <li className="px-1 text-xs text-muted-foreground">{t('finance.rateFrozen')}</li>
        </ul>
      )}
    </li>
  )
}

function MoneyTile({ label, value, currency, tone }: { label: string; value: number; currency: string; tone?: 'good' | 'bad' }) {
  return (
    <Card className="space-y-1 p-4">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className={cn('text-xl font-extrabold tabular-nums', tone === 'good' && 'text-success', tone === 'bad' && value > 0 && 'text-destructive')}>{formatMoney(value, currency)}</p>
    </Card>
  )
}

function MonthFinance({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const [filter, setFilter] = useState<'open' | 'paid'>()
  const { data, isLoading, isError, refetch } = usePlatformStatement(month)
  const partners = (data?.partners ?? []).filter((p) =>
    filter === 'paid' ? p.status === 'paid' || p.status === 'none' : filter === 'open' ? p.status === 'unpaid' || p.status === 'partial' || p.status === 'overpaid' : true,
  )
  return (
    <div className="space-y-4">
      <Input type="month" value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-10 w-auto rounded-full" aria-label={t('statement.month')} />
      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : isError || !data ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          {data.currencies.map((c) => (
            <section key={c.currency} className="space-y-3" aria-label={c.currency}>
              {data.currencies.length > 1 && <h3 className="font-bold">{t('finance.inCurrency', { currency: c.currency })}</h3>}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MoneyTile label={t('finance.earned')} value={c.commissionMinor} currency={c.currency} tone="good" />
                <MoneyTile label={t('finance.settled')} value={c.settledMinor} currency={c.currency} />
                <MoneyTile label={t('finance.owedToUs')} value={c.owedToPlatformMinor} currency={c.currency} tone="bad" />
                <MoneyTile label={t('finance.owedByUs')} value={c.owedToPartnersMinor} currency={c.currency} tone="bad" />
              </div>
              <Card className="p-5">
                <StatementSummary s={c} currency={c.currency} />
              </Card>
            </section>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Chips<'open' | 'paid'>
              value={filter}
              onChange={setFilter}
              options={[
                { label: t('finance.filter.all') },
                { value: 'open', label: t('finance.filter.open') },
                { value: 'paid', label: t('finance.filter.paid') },
              ]}
            />
            <span className="text-sm text-muted-foreground">{t('finance.partnersPaid', { paid: data.paidPartners, open: data.openPartners })}</span>
          </div>
          {partners.length === 0 ? (
            <EmptyState icon={ReceiptText} title={t('finance.noPartners')} className="py-8" />
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y">
                {partners.map((p) => (
                  <FinancePartnerRow key={p.ownerId} p={p} month={month} />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function OutstandingFinance({ onOpen }: { onOpen: (month: string) => void }) {
  const { data, isLoading, isError, refetch } = useOutstanding(true)
  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('finance.outstandingIntro')}</p>
      {data.currencies.map((c) => (
        <div key={c.currency} className="grid grid-cols-2 gap-3">
          <MoneyTile label={`${t('finance.owedToUs')} (${t('finance.due').toLowerCase()})`} value={c.owedToPlatformMinor} currency={c.currency} tone="bad" />
          <MoneyTile label={`${t('finance.owedByUs')} (${t('finance.due').toLowerCase()})`} value={c.owedToPartnersMinor} currency={c.currency} tone="bad" />
        </div>
      ))}
      {data.partners.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={t('finance.outstandingEmpty')} className="py-8" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y">
            {data.partners.map((p) => (
              <li key={p.ownerId} className="space-y-2 p-4 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {p.name}
                      {p.partnerStatus !== 'active' && <Badge variant="destructive">{t(`pm.status.${p.partnerStatus}`)}</Badge>}
                    </span>
                    <span className="block truncate text-muted-foreground">{p.email}</span>
                  </span>
                  {p.dueMinor !== 0 && (
                    <span className={cn('font-bold tabular-nums', p.dueMinor > 0 ? 'text-destructive' : 'text-success')}>
                      {t('finance.due')}: {formatMoney(Math.abs(p.dueMinor), p.currency)}
                    </span>
                  )}
                </div>
                <OpenMonths months={p.months} currency={p.currency} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function FinanceTab() {
  const [view, setView] = useState<'month' | 'outstanding'>('month')
  const [month, setMonth] = useState(currentMonth())
  return (
    <div className="space-y-4">
      <Chips<'month' | 'outstanding'>
        value={view}
        onChange={(v) => setView(v ?? 'month')}
        options={[
          { value: 'month', label: t('finance.view.month') },
          { value: 'outstanding', label: t('finance.view.outstanding') },
        ]}
      />
      {view === 'month' ? (
        <MonthFinance month={month} setMonth={setMonth} />
      ) : (
        <OutstandingFinance
          onOpen={(m) => {
            setMonth(m)
            setView('month')
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Partners: status (pause / block / delete) and warnings

const STATUS_BADGE = { active: 'success', paused: 'accent', blocked: 'destructive', deleted: 'muted' } as const

function PartnerPanel({ partner }: { partner: AdminUser }) {
  const { data, isLoading } = usePartnerStanding(partner.id)
  const { setStatus, warn, resolve, remove } = usePartnerModeration()
  const [pending, setPending] = useState<'paused' | 'blocked' | 'active' | null>(null)
  const [reason, setReason] = useState('')
  const [warning, setWarning] = useState('')
  const [warned, setWarned] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const status = data?.status ?? partner.partnerStatus
  const errorOf = (e: unknown) => (e instanceof ApiError ? e.message : t('common.errorText'))

  if (isLoading) return <Skeleton className="h-32 rounded-xl" />
  return (
    <div className="space-y-4 rounded-xl border bg-muted/30 p-3 text-sm">
      {data?.reason && status !== 'active' && <p className="font-medium">{t('standing.reason', { reason: data.reason })}</p>}

      {/* Status */}
      {pending ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t(pending === 'paused' ? 'pm.pauseHint' : pending === 'blocked' ? 'pm.blockHint' : 'pm.activateHint')}</p>
          {pending !== 'active' && (
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('pm.reason')} maxLength={1000} rows={2} aria-label={t('pm.reason')} />
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={pending === 'active' ? 'default' : 'destructive'}
              disabled={setStatus.isPending || (pending !== 'active' && reason.trim().length < 3)}
              onClick={() =>
                setStatus.mutate(
                  { id: partner.id, status: pending, reason: reason.trim() || undefined },
                  {
                    onSuccess: () => {
                      setPending(null)
                      setReason('')
                    },
                  },
                )
              }
            >
              {setStatus.isPending && <Loader2 className="animate-spin" />}
              {t('pm.confirm')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
              {t('settle.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {status !== 'active' && (
            <Button size="sm" onClick={() => setPending('active')}>
              <PlayCircle />
              {t('pm.activate')}
            </Button>
          )}
          {status === 'active' && (
            <Button size="sm" variant="outline" onClick={() => setPending('paused')}>
              <PauseCircle />
              {t('pm.pause')}
            </Button>
          )}
          {status !== 'blocked' && (
            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setPending('blocked')}>
              <Ban />
              {t('pm.block')}
            </Button>
          )}
        </div>
      )}
      {setStatus.isError && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {errorOf(setStatus.error)}
        </p>
      )}

      {/* Warning */}
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          warn.mutate(
            { id: partner.id, message: warning.trim() },
            {
              onSuccess: () => {
                setWarning('')
                setWarned(true)
              },
            },
          )
        }}
      >
        <label className="text-xs font-semibold" htmlFor={`warn-${partner.id}`}>
          {t('pm.warn')}
        </label>
        <Textarea
          id={`warn-${partner.id}`}
          value={warning}
          onChange={(e) => {
            setWarning(e.target.value)
            setWarned(false)
          }}
          placeholder={t('pm.warningPlaceholder')}
          maxLength={1000}
          rows={2}
        />
        <Button type="submit" size="sm" variant="outline" disabled={warn.isPending || warning.trim().length < 5}>
          {warn.isPending ? <Loader2 className="animate-spin" /> : <AlertTriangle />}
          {t('pm.sendWarning')}
        </Button>
        {warned && (
          <p role="status" className="text-xs font-semibold text-success">
            {t('pm.warningSent')}
          </p>
        )}
        {warn.isError && (
          <p role="alert" className="text-xs font-semibold text-destructive">
            {errorOf(warn.error)}
          </p>
        )}
      </form>

      {/* History */}
      <div>
        <p className="text-xs font-semibold">{t('pm.history')}</p>
        {data?.history.length ? (
          <ul className="divide-y">
            {data.history.map((n) => (
              <NoteItem
                key={n.id}
                note={n}
                action={
                  n.kind === 'warning' &&
                  !n.resolvedAt && (
                    <Button size="sm" variant="ghost" className="h-8" disabled={resolve.isPending} onClick={() => resolve.mutate(n.id)}>
                      <CheckCircle2 />
                      {t('pm.resolve')}
                    </Button>
                  )
                }
              />
            ))}
          </ul>
        ) : (
          <p className="py-2 text-xs text-muted-foreground">{t('pm.noHistory')}</p>
        )}
      </div>

      {/* Delete */}
      <div className="space-y-2 border-t pt-3">
        <Input value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder={t('pm.deleteReason')} maxLength={1000} className="h-10 rounded-lg" aria-label={t('pm.deleteReason')} />
        {deleteReason.trim().length >= 3 ? (
          <ConfirmDelete
            label={t('pm.delete')}
            question={t('pm.deleteConfirm', { name: partner.name })}
            onConfirm={() => remove.mutate({ id: partner.id, reason: deleteReason.trim() })}
            pending={remove.isPending}
            error={remove.error}
          />
        ) : (
          <p className="text-xs text-muted-foreground">{t('pm.deleteNeedsReason')}</p>
        )}
      </div>
    </div>
  )
}

function PartnerRow({ partner }: { partner: AdminUser }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <span className="truncate">{partner.name}</span>
            <Badge variant={STATUS_BADGE[partner.partnerStatus]}>{t(`pm.status.${partner.partnerStatus}`)}</Badge>
          </p>
          <p className="truncate text-sm text-muted-foreground">{partner.email}</p>
          <p className="text-xs text-muted-foreground">{t('admin.locations', { count: partner.businessCount })}</p>
        </div>
        <Button size="sm" variant={open ? 'secondary' : 'outline'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {t('pm.manage')}
          <ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
        </Button>
      </div>
      {open && <PartnerPanel partner={partner} />}
    </li>
  )
}

function PartnersTab() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'active' | 'paused' | 'blocked'>()
  const [limit, setLimit] = useState(PAGE)
  const { data, isLoading, isError, refetch, isFetching } = useAdminUsers({ q: q || undefined, role: 'business', limit })
  const partners = (data?.data ?? []).filter((u) => !status || u.partnerStatus === status)

  return (
    <div className="space-y-4">
      <SearchBox
        placeholder={t('pm.searchPartners')}
        onSearch={(v) => {
          setQ(v)
          setLimit(PAGE)
        }}
      />
      <Chips<'active' | 'paused' | 'blocked'>
        value={status}
        onChange={setStatus}
        options={[
          { label: t('admin.all') },
          { value: 'active', label: t('pm.status.active') },
          { value: 'paused', label: t('pm.status.paused') },
          { value: 'blocked', label: t('pm.status.blocked') },
        ]}
      />
      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : partners.length === 0 ? (
        <EmptyState icon={Store} title={q || status ? t('admin.noResults') : t('pm.empty')} />
      ) : (
        <>
          <Card className={cn('overflow-hidden', isFetching && 'opacity-70')}>
            <ul className="divide-y">
              {partners.map((u) => (
                <PartnerRow key={u.id} partner={u} />
              ))}
            </ul>
          </Card>
          {data && data.data.length < data.meta.total && (
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
// Pickup integrity: are partners recording hand-overs (scanning)?

const RISK_BADGE = { high: 'destructive', medium: 'accent', low: 'success' } as const
const pct = (v: number) => `${Math.round(v * 100)}%`

function DisputeRow({ r }: { r: Reservation }) {
  const resolve = useResolveDispute()
  const [note, setNote] = useState('')
  return (
    <li className="space-y-2 p-4 text-sm">
      <p className="font-semibold">
        <span className="font-mono text-primary">{r.code}</span> · {r.business.name} · {r.customer?.name ?? '—'}
      </p>
      <p className="text-muted-foreground">
        {r.quantity} × {r.offer.title} · {formatPickupWindow(r.pickupStart, r.pickupEnd, r.timezone)} · {formatMoney(r.totalMinor, r.currency)}
      </p>
      <p className="rounded-lg bg-muted/60 p-2">
        <span className="font-semibold">{t('integrity.partnerSays')}:</span> {r.dispute?.reason}
      </p>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('integrity.notePlaceholder')} maxLength={500} className="h-10 rounded-lg" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: r.id, decision: 'upheld', note: note.trim() || undefined })}>
          {t('integrity.uphold')}
        </Button>
        <Button size="sm" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: r.id, decision: 'rejected', note: note.trim() || undefined })}>
          {t('integrity.reject')}
        </Button>
      </div>
    </li>
  )
}

function IntegrityTab() {
  const [days, setDays] = useState<'7' | '30' | '90'>('30')
  const { data, isLoading, isError, refetch } = usePlatformIntegrity(Number(days))
  const disputes = useDisputes()
  const alerts = useIntegrityAlerts()
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{t('integrity.intro')}</p>
      <Chips<'7' | '30' | '90'> value={days} onChange={(v) => setDays(v ?? '30')} options={(['7', '30', '90'] as const).map((d) => ({ value: d, label: t('pickups.lastDays', { days: d }) }))} />

      {!!disputes.data?.length && (
        <section className="space-y-2">
          <h2 className="font-bold">{t('integrity.disputes', { count: disputes.data.length })}</h2>
          <Card className="overflow-hidden border-accent">
            <ul className="divide-y">
              {disputes.data.map((r) => (
                <DisputeRow key={r.id} r={r} />
              ))}
            </ul>
          </Card>
        </section>
      )}

      {!!alerts.data?.length && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 font-bold">
            <MapPinCheck className="size-5 text-destructive" />
            {t('arrival.alertsTitle', { count: alerts.data.length })}
          </h2>
          <p className="text-sm text-muted-foreground">{t('arrival.alertsIntro')}</p>
          <Card className="overflow-hidden border-destructive/40">
            <ul className="divide-y">
              {alerts.data.map((r) => (
                <li key={r.id} className="space-y-1 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      <span className="font-mono text-primary">{r.code}</span> · {r.business.name}
                    </span>
                    <Badge variant="destructive">{t(r.integrityAlert?.kind === 'arrived_cancelled' ? 'arrival.kind.cancelled' : 'arrival.kind.notScanned')}</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {r.customer?.name ?? '—'} · {r.quantity} × {r.offer.title} · {formatMoney(r.totalMinor, r.currency)}
                  </p>
                  {r.presence && (
                    <p className="text-muted-foreground">
                      {t('arrival.evidence', {
                        window: formatPickupWindow(r.pickupStart, r.pickupEnd, r.timezone),
                        at: formatTime(r.presence.firstAt, r.timezone),
                        meters: r.presence.minDistanceMeters,
                      })}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : isError || !data ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile icon={CalendarCheck} label={t('integrity.finished')} value={data.platform.total} />
            <StatTile icon={ScanLine} label={t('pickups.scanned')} value={data.platform.collected ? pct(data.platform.scannedRate) : '—'} />
            <StatTile icon={Ban} label={t('integrity.avgNoShow')} value={data.platform.total ? pct(data.platform.noShowRate) : '—'} />
            <StatTile icon={AlertTriangle} label={t('pickups.byCustomer')} value={data.platform.viaCustomer} />
          </div>
          {data.partners.length === 0 ? (
            <EmptyState icon={ShieldCheck} title={t('integrity.empty')} className="py-8" />
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y">
                {data.partners.map((p) => (
                  <li key={p.ownerId} className="space-y-2 p-4 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2 font-semibold">
                          {p.name}
                          <Badge variant={RISK_BADGE[p.risk]}>{t(`integrity.risk.${p.risk}`)}</Badge>
                          {p.openDisputes > 0 && <Badge variant="accent">{t('integrity.openDisputes', { count: p.openDisputes })}</Badge>}
                        </span>
                        <span className="block truncate text-muted-foreground">
                          {p.email} · {p.locations.join(', ')}
                        </span>
                      </span>
                      {p.commissionAtRiskMinor > 0 && (
                        <span className="text-right text-xs text-muted-foreground">
                          {t('integrity.atRisk')}
                          <span className="block text-base font-bold text-foreground tabular-nums">{formatMoney(p.commissionAtRiskMinor, p.currency)}</span>
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                      <span>
                        {t('integrity.noShow')}: <strong className={cn(p.flags.includes('high_no_show') && 'text-destructive')}>{pct(p.noShowRate)}</strong>
                        <span className="text-muted-foreground"> ({p.expired}/{p.total})</span>
                      </span>
                      <span>
                        {t('pickups.scanned')}: <strong className={cn(p.flags.includes('manual_handover') && 'text-destructive')}>{p.collected ? pct(p.scannedRate) : '—'}</strong>
                      </span>
                      <span>
                        {t('pickups.byCustomer')}: <strong className={cn(p.viaCustomer > 0 && 'text-destructive')}>{p.viaCustomer}</strong>
                      </span>
                      <span>
                        {t('integrity.repeat')}: <strong className={cn(p.repeatNoShowCustomers >= 2 && 'text-destructive')}>{p.repeatNoShowCustomers}</strong>
                      </span>
                      {!!p.arrivedNotScanned && (
                        <span>
                          {t('arrival.column')}: <strong className="text-destructive">{p.arrivedNotScanned}</strong>
                        </span>
                      )}
                    </div>
                    {p.flags.length > 0 && (
                      <ul className="list-inside list-disc text-xs text-muted-foreground">
                        {p.flags.map((f) => (
                          <li key={f}>{t(`integrity.flag.${f}`)}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function DonationsTab() {
  const { data, isLoading, isError, refetch } = useDonations(true)
  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />
  return <DonationTable list={data} />
}

// ---------------------------------------------------------------------------

function AdminPanel() {
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const visible = TABS.filter((id) => can(TAB_PERMISSION[id]))
  const requested = params.get('tab') as Tab
  const tab: Tab = visible.includes(requested) ? requested : visible[0]

  return (
    <div className="space-y-5">
      <div role="tablist" className="scrollbar-none -mx-4 flex max-w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:max-w-full sm:px-0">
        <div className="inline-flex shrink-0 rounded-full bg-muted p-1">
        {visible.map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setParams(id === visible[0] ? {} : { tab: id }, { replace: true })}
            className={cn(
              'h-10 shrink-0 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-all sm:px-5',
              tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            {t(`admin.tab.${id}`)}
          </button>
        ))}
        </div>
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'users' && <UsersTab />}
      {tab === 'partners' && <PartnersTab />}
      {tab === 'businesses' && <BusinessesTab />}
      {tab === 'applications' && <ApplicationsTab />}
      {tab === 'reservations' && <ReservationsTab />}
      {tab === 'reviews' && <ReviewsTab />}
      {tab === 'support' && <SupportTab />}
      {tab === 'promotions' && <PromotionsManager platform />}
      {tab === 'finance' && <FinanceTab />}
      {tab === 'integrity' && <IntegrityTab />}
      {tab === 'donations' && <DonationsTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  )
}

export function AdminPage() {
  return (
    <div>
      <PageHeader title={t('admin.title')} subtitle={t('admin.intro')} />
      <RoleGuard roles={PLATFORM_ROLES} deniedText={t('admin.noAccess')}>
        <AdminPanel />
      </RoleGuard>
    </div>
  )
}
