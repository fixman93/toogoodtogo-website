import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Bell, Camera, Download, FileText, Phone, ChevronRight, Cloud, Gift, Globe, Languages, LifeBuoy, Mail, Trophy, Leaf, Loader2, LogOut, ShieldCheck, Store, Trash2, Wallet } from 'lucide-react'
import { ApiError } from '@/api/client'
import { authApi } from '@/api/services'
import { PasswordInput } from '@/components/ui/password-input'
import { NativeSelect } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/common/PageHeader'
import { RequireAuth } from '@/components/common/RequireAuth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MARKET_LIST, market, setMarket } from '@/config/markets'
import { StandingNotice } from '@/features/business/StandingNotice'
import { useAuth } from '@/features/auth/auth-context'
import { PLATFORM_ROLES } from '@/api/types'
import { useDeleteAccount, useReservations, useUpdatePreferences, useUpdateProfile, useUploadImage } from '@/hooks/api'
import { isNativeApp } from '@/lib/platform'
import { currentSubscription, disablePush, enablePush, pushSupported } from '@/lib/push'
import { activeLocale, localize, setScript, script, t } from '@/i18n'
import { formatDate, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Rough CO2e avoided per rescued bag (kg) — same estimate as the backend. */
const CO2E_KG_PER_BAG = 2.7
const co2Formatter = new Intl.NumberFormat(activeLocale, { maximumFractionDigits: 1 })

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
          <PasswordInput autoComplete="current-password" placeholder={t('profile.deleteConfirmPassword')} value={password} onChange={(e) => setPassword(e.target.value)} />
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
  // Savings per currency (bags bought in Serbia and Montenegro aren't added together).
  const savedBy = new Map<string, number>()
  for (const r of collected) savedBy.set(r.currency, (savedBy.get(r.currency) ?? 0) + (r.originalUnitPriceMinor - r.unitPriceMinor) * r.quantity)
  const saved = savedBy.size ? [...savedBy].map(([currency, minor]) => formatMoney(minor, currency)).join(' + ') : formatMoney(0, market.currency)
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
        <p className="text-2xl font-extrabold">{saved}</p>
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

/** Country: default city, cities list and price filter. Saved on the account and on this device. */
function CountrySetting() {
  const update = useUpdateProfile()
  return (
    <SettingRow icon={Globe} label={t('profile.country')}>
      <NativeSelect
        aria-label={t('profile.country')}
        value={market.code}
        disabled={update.isPending}
        onChange={(e) => {
          const code = e.target.value
          // Save on the account first so other devices follow; switch locally either way.
          update.mutate({ countryCode: code }, { onSettled: () => setMarket(code) })
        }}
        className="h-9 w-auto max-w-[12rem] rounded-full text-sm"
      >
        {MARKET_LIST.map((m) => (
          <option key={m.code} value={m.code}>
            {localize(m.name)}
          </option>
        ))}
      </NativeSelect>
    </SettingRow>
  )
}

function Switch({ on, onToggle, label, disabled }: { on: boolean; onToggle: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50', on ? 'bg-primary' : 'bg-input')}
    >
      <span className={cn('absolute top-1 size-5 rounded-full bg-white shadow transition-all', on ? 'left-6' : 'left-1')} />
    </button>
  )
}

/** Push on this device + e-mail preference. */
function NotificationSettings() {
  const { user } = useAuth()
  const prefs = useUpdatePreferences()
  const [pushOn, setPushOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(isNativeApp() ? t('profile.pushInApp') : pushSupported() ? null : t('profile.pushUnsupported'))
  useEffect(() => {
    void currentSubscription().then((sub) => setPushOn(!!sub))
  }, [])

  const togglePush = async () => {
    setBusy(true)
    setMessage(null)
    try {
      if (pushOn) {
        await disablePush()
        setPushOn(false)
      } else {
        const result = await enablePush()
        if (result === 'enabled') setPushOn(true)
        else setMessage(t(result === 'denied' ? 'profile.pushDenied' : result === 'server-disabled' ? 'profile.pushDisabled' : 'profile.pushUnsupported'))
      }
    } catch {
      // e.g. the browser has no push service (some privacy modes) — explain instead of failing.
      setMessage(t('profile.pushUnsupported'))
    } finally {
      setBusy(false)
    }
  }
  const emailOn = user?.notificationPrefs?.email !== false
  return (
    <>
      <SettingRow icon={Bell} label={t('profile.pushNotifications')}>
        <Switch on={pushOn} onToggle={togglePush} label={t('profile.pushNotifications')} disabled={busy || !pushSupported()} />
      </SettingRow>
      {message && <p className="px-4 py-2 text-xs text-muted-foreground">{message}</p>}
      <SettingRow icon={Mail} label={t('profile.emailNotifications')}>
        <Switch on={emailOn} onToggle={() => prefs.mutate({ email: !emailOn })} label={t('profile.emailNotifications')} disabled={prefs.isPending} />
      </SettingRow>
    </>
  )
}

/** Loyalty points, level progress and the personal invite link. */
function Rewards() {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  if (!user?.level) return null
  const points = user.points ?? 0
  const level = user.level
  const progress = level.nextAt ? Math.min(100, Math.round((points / level.nextAt) * 100)) : 100
  const inviteUrl = user.referralCode ? `${window.location.origin}/register?ref=${user.referralCode}` : null

  const share = async () => {
    if (!inviteUrl) return
    if (navigator.share) {
      try {
        await navigator.share({ title: t('brand.name'), text: t('profile.inviteMessage'), url: inviteUrl })
        return
      } catch {
        /* closed */
      }
    }
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
    } catch {
      /* blocked */
    }
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{t('profile.level')}</p>
          <p className="flex items-center gap-2 text-lg font-extrabold">
            <Trophy className="size-5 text-accent-foreground" />
            {localize(level.name)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold tabular-nums">{points}</p>
          <p className="text-sm text-muted-foreground">{t('profile.points')}</p>
        </div>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {level.nextAt ? t('profile.nextLevel', { points: level.nextAt - points, level: localize(level.nextName ?? '') }) : t('profile.maxLevel')} · {t('profile.pointsHint')}
      </p>
      <Button asChild variant="secondary" className="w-full">
        <Link to="/impact">
          <Leaf />
          {t('impact.open')}
        </Link>
      </Button>
      {inviteUrl && (
        <div className="space-y-2 border-t pt-3">
          <p className="font-semibold">{t('profile.invite')}</p>
          <p className="text-sm text-muted-foreground">{t('profile.inviteTextDiscount', { percent: user.referralDiscountPercent ?? 30 })}</p>
          <Button variant="outline" size="sm" onClick={share}>
            <Gift />
            {t('profile.inviteShare')}
          </Button>
          {copied && <p className="text-xs font-semibold text-success">{t('profile.inviteCopied')}</p>}
        </div>
      )}
    </Card>
  )
}

/** Tap the avatar to upload a new profile photo (stored on R2). */
function AvatarEditor({ initials, url }: { initials: string; url?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const upload = useUploadImage('avatar')
  const update = useUpdateProfile()
  const busy = upload.isPending || update.isPending
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={t('profile.changePhoto')}
        disabled={busy}
        onClick={() => input.current?.click()}
        className="group relative flex size-16 items-center justify-center overflow-hidden rounded-full bg-primary text-xl font-extrabold text-primary-foreground"
      >
        {url ? <img src={url} alt="" className="size-full object-cover" /> : initials}
        <span className="absolute inset-x-0 bottom-0 flex h-6 items-center justify-center bg-black/45 text-white">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) upload.mutate(file, { onSuccess: ({ url: next }) => update.mutate({ avatarUrl: next }) })
        }}
      />
      {upload.isError && (
        <p role="alert" className="absolute top-full left-0 mt-1 w-48 text-xs text-destructive">
          {upload.error instanceof ApiError ? upload.error.message : t('common.errorText')}
        </p>
      )}
    </div>
  )
}

/** Phone number: required for new accounts; older accounts are asked to add one. One number per account. */
function PhoneSetting({ phone }: { phone: string | null }) {
  const update = useUpdateProfile()
  const [editing, setEditing] = useState(!phone)
  const [value, setValue] = useState(phone ?? '')
  const [saved, setSaved] = useState(false)
  const cancel = () => {
    setEditing(false)
    setValue(phone ?? '')
  }
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(false)
    update.mutate(
      { phone: value },
      {
        onSuccess: (u) => {
          setValue(u.phone ?? '')
          setEditing(false)
          setSaved(true)
        },
      },
    )
  }
  return (
    <Card className={cn('space-y-3 p-4', !phone && 'border-accent bg-accent/10')}>
      <div className="flex items-center gap-3">
        <Phone className="size-5 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{t('auth.phone')}</p>
          {phone && !editing && <p className="text-sm text-muted-foreground tabular-nums">{phone}</p>}
          {!phone && <p className="text-sm text-muted-foreground">{t('profile.phoneMissing')}</p>}
        </div>
        {phone && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {t('profile.phoneChange')}
          </Button>
        )}
      </div>
      {editing && (
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={save}>
          <Input type="tel" inputMode="tel" autoComplete="tel" value={value} onChange={(e) => setValue(e.target.value)} placeholder={market.phoneExample} aria-label={t('auth.phone')} className="sm:flex-1" />
          <div className="flex gap-2">
            <Button type="submit" disabled={update.isPending || value.replace(/\D/g, '').length < 6}>
              {update.isPending && <Loader2 className="animate-spin" />}
              {t('profile.phoneSave')}
            </Button>
            {phone && (
              <Button type="button" variant="ghost" onClick={cancel}>
                {t('settle.cancel')}
              </Button>
            )}
          </div>
        </form>
      )}
      {update.isError && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {update.error instanceof ApiError ? update.error.message : t('common.errorText')}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm font-semibold text-success">
          {t('profile.phoneSaved')}
        </p>
      )}
    </Card>
  )
}

/** GDPR: policy links + download of all personal data (access / portability). */
function PrivacySection() {
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle')
  const download = async () => {
    setState('busy')
    try {
      const data = await authApi.exportMyData()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `foodnesi-moji-podaci-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setState('idle')
    } catch {
      setState('error')
    }
  }
  return (
    <section className="space-y-3">
      <h2 className="font-bold">{t('legal.privacySection')}</h2>
      <Card className="divide-y">
        <Link to="/privacy" className="flex min-h-14 items-center gap-3 px-4 font-medium">
          <ShieldCheck className="size-5 text-muted-foreground" />
          <span className="flex-1">{t('legal.privacy')}</span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>
        <Link to="/terms" className="flex min-h-14 items-center gap-3 px-4 font-medium">
          <FileText className="size-5 text-muted-foreground" />
          <span className="flex-1">{t('legal.terms')}</span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>
        <button type="button" onClick={download} disabled={state === 'busy'} className="flex min-h-14 w-full items-center gap-3 px-4 text-left font-medium disabled:opacity-60">
          {state === 'busy' ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : <Download className="size-5 text-muted-foreground" />}
          <span className="flex-1">{t('legal.export')}</span>
        </button>
      </Card>
      {state === 'error' && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {t('common.errorText')}
        </p>
      )}
    </section>
  )
}

function Profile() {
  const { user, logout, hasRole } = useAuth()
  if (!user) return null
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <StandingNotice />
      <Card className="flex items-center gap-4 p-5">
        <AvatarEditor initials={initials} url={user.avatarUrl} />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground">{t('profile.memberSince', { date: formatDate(user.createdAt) })}</p>
        </div>
      </Card>
      <PhoneSetting phone={user.phone ?? null} />

      <section className="space-y-3">
        <h2 className="font-bold">{t('profile.impact')}</h2>
        <Impact />
      </section>

      <Rewards />

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

      {hasRole('business', 'admin', 'staff') && (
        <Link to="/business" className="flex min-h-14 items-center gap-3 rounded-2xl bg-secondary px-4 font-semibold text-secondary-foreground">
          <Store className="size-5" />
          <span className="flex-1">{hasRole('staff') ? t('profile.staffPortal') : t('profile.businessPortal')}</span>
          <ChevronRight className="size-5" />
        </Link>
      )}
      {hasRole(...PLATFORM_ROLES) && (
        <Link to="/admin" className="flex min-h-14 items-center gap-3 rounded-2xl bg-accent/30 px-4 font-semibold text-accent-foreground">
          <ShieldCheck className="size-5" />
          <span className="flex-1">{hasRole('admin') ? t('admin.title') : t('admin.teamPanel')}</span>
          <ChevronRight className="size-5" />
        </Link>
      )}
      <Link to="/support" className="flex min-h-14 items-center gap-3 rounded-2xl border px-4 font-semibold">
        <LifeBuoy className="size-5 text-primary" />
        <span className="flex-1">{t('profile.support')}</span>
        <ChevronRight className="size-5" />
      </Link>

      <section className="space-y-3">
        <h2 className="font-bold">{t('profile.settings')}</h2>
        <Card className="divide-y">
          <SettingRow icon={Globe} label={t('profile.language')} value={script === 'cyrl' ? 'Српски' : 'Srpski'} />
          <SettingRow icon={Languages} label={t('profile.script')}>
            <div className="inline-flex rounded-full bg-muted p-1" role="radiogroup" aria-label={t('profile.script')}>
              {(['latn', 'cyrl'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={script === s}
                  onClick={() => script !== s && setScript(s)}
                  className={cn('h-8 rounded-full px-3 text-sm font-semibold', script === s ? 'bg-card shadow-sm' : 'text-muted-foreground')}
                >
                  {s === 'latn' ? 'Latinica' : 'Ћирилица'}
                </button>
              ))}
            </div>
          </SettingRow>
          <CountrySetting />
          <SettingRow icon={Wallet} label={t('profile.currency')} value={market.currency} />
          <NotificationSettings />
        </Card>
      </section>

      <div className="space-y-2">
        <Button variant="outline" className="w-full" onClick={logout}>
          <LogOut />
          {t('auth.logout')}
        </Button>
      </div>

      <PrivacySection />
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
