import { useCallback, useEffect, useState } from 'react'
import { BellRing, Camera, ChevronDown, Loader2, MapPin, Share, ShieldAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { useLocation } from '@/features/location/location-context'
import { t, type MessageKey } from '@/i18n'
import { isNativeApp } from '@/lib/platform'
import { currentSubscription, enablePush, pushSupported } from '@/lib/push'
import { cn } from '@/lib/utils'

type Need = 'location' | 'notifications' | 'camera'
type State = 'ok' | 'ask' | 'denied' | 'ios-install'

/** "Later" hides the banner for a while; it comes back (the app needs these). */
const SNOOZE_KEY = 'foodnesi.permissions.snoozedUntil'
const SNOOZE_MS = 3 * 86_400_000

const snoozed = () => {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now()
  } catch {
    return false
  }
}

/** iPhone/iPad Safari tab (not the home-screen app): push only after "Add to Home Screen". */
const isIosBrowserTab = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator as Navigator & { standalone?: boolean }).standalone && !matchMedia('(display-mode: standalone)').matches

const platform = (): 'ios-app' | 'android-app' | 'ios-web' | 'android-web' | 'desktop' => {
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor
  if (isNativeApp()) return cap?.getPlatform?.() === 'ios' ? 'ios-app' : 'android-app'
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return 'ios-web'
  if (/Android/.test(navigator.userAgent)) return 'android-web'
  return 'desktop'
}

async function queryPermission(name: 'geolocation' | 'camera'): Promise<PermissionState | 'unknown'> {
  try {
    const status = await navigator.permissions?.query({ name: name as PermissionName })
    return status?.state ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Top banner when something the app relies on is off: location (everyone),
 * notifications (signed-in users on the web — the iOS/Android apps get native
 * push later) and the camera (partners/staff, for the QR scanner). One tap asks
 * again; if the browser/phone blocked it, it shows where to turn it on.
 */
export function PermissionBanner() {
  const { user, hasRole } = useAuth()
  const { isDeviceLocation, locateDevice } = useLocation()
  const [states, setStates] = useState<Partial<Record<Need, State>>>({})
  const [busy, setBusy] = useState<Need | null>(null)
  const [hidden, setHidden] = useState(snoozed)
  const [help, setHelp] = useState(false)
  const scanner = hasRole('business', 'staff')

  const check = useCallback(async () => {
    const next: Partial<Record<Need, State>> = {}
    // Location: the browser's answer wins — a GPS position saved earlier doesn't count once it's
    // been turned off. Only when the browser can't tell, a device position means it's fine.
    const geo = await queryPermission('geolocation')
    next.location = geo === 'granted' || (geo === 'unknown' && isDeviceLocation) ? 'ok' : geo === 'denied' ? 'denied' : 'ask'
    // Notifications: web push for signed-in users only.
    if (user && !isNativeApp()) {
      if (isIosBrowserTab()) next.notifications = 'ios-install'
      else if (!pushSupported()) next.notifications = 'ok'
      else if (Notification.permission === 'denied') next.notifications = 'denied'
      else next.notifications = (await currentSubscription().catch(() => null)) ? 'ok' : 'ask'
    }
    // Camera: only nag when it was blocked (the scanner asks by itself the first time).
    if (scanner) next.camera = (await queryPermission('camera')) === 'denied' ? 'denied' : 'ok'
    setStates(next)
  }, [isDeviceLocation, user, scanner])

  useEffect(() => {
    const first = setTimeout(() => void check(), 0)
    // Re-check when the user comes back from the phone/browser settings.
    const onVisible = () => document.visibilityState === 'visible' && void check()
    document.addEventListener('visibilitychange', onVisible)
    // …and when it's toggled from the address bar without leaving the page.
    const onChange = () => void check()
    const statuses = (['geolocation', 'camera'] as const).map((name) =>
      navigator.permissions
        ?.query({ name: name as PermissionName })
        .then((status) => (status.addEventListener('change', onChange), status))
        .catch(() => undefined),
    )
    return () => {
      clearTimeout(first)
      document.removeEventListener('visibilitychange', onVisible)
      statuses.forEach((p) => void p?.then((status) => status?.removeEventListener('change', onChange)))
    }
  }, [check])

  const missing = (Object.entries(states) as [Need, State][]).filter(([, s]) => s !== 'ok')
  if (hidden || missing.length === 0) return null

  const fix = async (need: Need) => {
    setBusy(need)
    try {
      if (need === 'location') await locateDevice()
      if (need === 'notifications') await enablePush().catch(() => undefined)
      if (need === 'camera') {
        const stream = await navigator.mediaDevices?.getUserMedia({ video: true }).catch(() => null)
        stream?.getTracks().forEach((track) => track.stop())
      }
    } finally {
      setBusy(null)
      await check()
    }
  }

  const snooze = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS))
    } catch {
      // private mode — hide for this visit only
    }
    setHidden(true)
  }

  const ICON = { location: MapPin, notifications: BellRing, camera: Camera }
  const anyBlocked = missing.some(([, s]) => s === 'denied' || s === 'ios-install')
  const where = platform()

  return (
    <div role="status" className="mb-4 rounded-2xl border border-accent/60 bg-accent/15 p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-accent-foreground" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-bold">{t('perm.title')}</p>
          <ul className="flex flex-wrap gap-2">
            {missing.map(([need, state]) => {
              const Icon = ICON[need]
              const canAsk = state === 'ask'
              return (
                <li key={need}>
                  <Button
                    size="sm"
                    variant={canAsk ? 'default' : 'outline'}
                    className="h-9"
                    disabled={busy === need}
                    // Blocked: try again anyway (it may have been allowed in the settings meanwhile), then show how.
                    onClick={() => void fix(need).then(() => !canAsk && setHelp(true))}
                  >
                    {busy === need ? <Loader2 className="animate-spin" /> : <Icon />}
                    {t(canAsk ? (`perm.enable.${need}` as MessageKey) : (`perm.blocked.${need}` as MessageKey))}
                  </Button>
                </li>
              )
            })}
          </ul>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {missing.map(([need]) => (
              <li key={need}>{t(`perm.why.${need}` as MessageKey)}</li>
            ))}
          </ul>
          {anyBlocked && (
            <button type="button" onClick={() => setHelp((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-primary underline" aria-expanded={help}>
              {t('perm.howTo')}
              <ChevronDown className={cn('size-3.5 transition-transform', help && 'rotate-180')} />
            </button>
          )}
          {help && (
            <div className="space-y-1 rounded-xl bg-background/80 p-3 text-xs">
              {missing.some(([, s]) => s === 'ios-install') && (
                <p>
                  {t('pushPrompt.iosBefore')} <Share className="inline size-3.5 align-text-bottom" /> {t('pushPrompt.iosAfter')}
                </p>
              )}
              {missing.some(([, s]) => s === 'denied') && <p>{t(`perm.settings.${where}` as MessageKey)}</p>}
            </div>
          )}
        </div>
        <button type="button" onClick={snooze} aria-label={t('perm.later')} title={t('perm.later')} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
