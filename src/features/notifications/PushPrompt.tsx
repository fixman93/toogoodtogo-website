import { useEffect, useState } from 'react'
import { BellRing, Loader2, Share, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { t } from '@/i18n'
import { currentSubscription, enablePush, pushSupported } from '@/lib/push'

const DISMISS_KEY = 'zalogaj.pushPrompt.dismissed'

/** iPhone/iPad Safari tab (not the home-screen app): push only works after "Add to Home Screen". */
const isIosBrowserTab = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator as Navigator & { standalone?: boolean }).standalone && !matchMedia('(display-mode: standalone)').matches

const dismissed = () => {
  try {
    return !!localStorage.getItem(DISMISS_KEY)
  } catch {
    return false
  }
}

/**
 * Partner portal: invite the partner (or staff) to turn on push on this
 * phone so new orders pop up on the lock screen. Hidden once enabled, when
 * blocked in settings, or after "Ne sada".
 */
export function PushPrompt() {
  const [state, setState] = useState<'hidden' | 'ios-install' | 'ask'>(() => (dismissed() ? 'hidden' : isIosBrowserTab() ? 'ios-install' : 'hidden'))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (dismissed() || isIosBrowserTab() || !pushSupported() || Notification.permission === 'denied') return
    void currentSubscription()
      .then((sub) => setState(sub ? 'hidden' : 'ask'))
      .catch(() => undefined)
  }, [])

  if (state === 'hidden') return null
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setState('hidden')
  }

  const enable = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await enablePush()
      if (result === 'enabled') setState('hidden')
      else setMessage(t(result === 'denied' ? 'profile.pushDenied' : result === 'server-disabled' ? 'profile.pushDisabled' : 'profile.pushUnsupported'))
    } catch {
      setMessage(t('profile.pushUnsupported'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="relative flex flex-col gap-3 border-primary/30 bg-secondary/60 p-4 sm:flex-row sm:items-center">
      <button type="button" onClick={dismiss} aria-label={t('pushPrompt.later')} className="absolute top-2 right-2 rounded-full p-1.5 text-muted-foreground hover:bg-muted">
        <X className="size-4" />
      </button>
      <BellRing className="size-6 shrink-0 text-primary" />
      <div className="flex-1 space-y-1 pr-6">
        <p className="font-bold">{t('pushPrompt.title')}</p>
        {state === 'ios-install' ? (
          <p className="text-sm text-muted-foreground">
            {t('pushPrompt.iosBefore')} <Share className="inline size-4 align-text-bottom" /> {t('pushPrompt.iosAfter')}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t('pushPrompt.text')}</p>
        )}
        {message && <p className="text-xs font-semibold text-destructive">{message}</p>}
      </div>
      {state === 'ask' && (
        <Button onClick={enable} disabled={busy} className="shrink-0">
          {busy ? <Loader2 className="animate-spin" /> : <BellRing />}
          {t('pushPrompt.enable')}
        </Button>
      )}
    </Card>
  )
}
