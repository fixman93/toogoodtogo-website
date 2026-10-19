import logoLight from '@/assets/images/web/foodnesi-logo-full-light.png'
import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Award, CalendarHeart, Cloud, Compass, Flame, Leaf, Loader2, Moon, PiggyBank, Share2, ShoppingBag, Sparkles, Sunrise, Target, Trophy, type LucideIcon } from 'lucide-react'
import type { Impact } from '@/api/types'
import { RequireAuth } from '@/components/common/RequireAuth'
import { ErrorState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { useImpact } from '@/hooks/api'
import { activeLocale, t, type MessageKey } from '@/i18n'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

const BADGE_ICONS: Record<Impact['badges'][number]['key'], LucideIcon> = {
  first: ShoppingBag,
  ten: Award,
  fifty: Trophy,
  explorer: Compass,
  early: Sunrise,
  night: Moon,
  streak: Flame,
}

const number = (n: number) => new Intl.NumberFormat(activeLocale, { maximumFractionDigits: 1 }).format(n)
const monthName = (m: number) => new Intl.DateTimeFormat(activeLocale, { month: 'long' }).format(new Date(2026, m - 1, 15))

function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card">
      <Icon className="size-5 text-primary" />
      <p className="mt-2 text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

/**
 * Story image (1080×1920) of the yearly recap, drawn on a canvas so it can be
 * shared as a picture (Instagram story, WhatsApp…) without any extra library.
 */
async function recapImage(impact: Impact, name: string): Promise<Blob> {
  const r = impact.recap
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1920
  const ctx = canvas.getContext('2d')!
  await document.fonts?.ready
  const font = getComputedStyle(document.body).fontFamily
  const bg = ctx.createLinearGradient(0, 0, 1080, 1920)
  bg.addColorStop(0, '#0f5541')
  bg.addColorStop(1, '#0a3a2c')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 1080, 1920)
  // Soft accent circles.
  ctx.fillStyle = 'rgba(253, 142, 22, 0.16)'
  ctx.beginPath()
  ctx.arc(980, 260, 260, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(80, 1700, 200, 0, Math.PI * 2)
  ctx.fill()

  const text = (s: string, x: number, y: number, size: number, weight = 700, color = '#ffffff', align: CanvasTextAlign = 'left') => {
    ctx.font = `${weight} ${size}px ${font}`
    ctx.fillStyle = color
    ctx.textAlign = align
    ctx.fillText(s, x, y)
  }
  // Brand logo (cream letters for the green background); falls back to text if it can't load.
  const logo = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = logoLight
  })
  if (logo) ctx.drawImage(logo, 90, 90, 440, (440 * logo.height) / logo.width)
  else text('Foodnesi', 90, 170, 64, 800, '#fd8e16')
  text(t('impact.storyTitle', { year: r.year }), 90, 380, 84, 800)
  text(name, 90, 460, 44, 600, 'rgba(255,255,255,0.75)')

  const savings = r.savings[0]
  const rows: [string, string][] = [
    [String(r.bags), t('impact.storyBags', { count: r.bags })],
    [`${number(r.kgFood)} kg`, t('impact.storyFood')],
    [`${number(r.co2Kg)} kg`, t('impact.storyCo2')],
    ...(savings ? ([[formatMoney(savings.minor, savings.currency), t('impact.storySaved')]] as [string, string][]) : []),
  ]
  rows.forEach(([value, label], i) => {
    const y = 620 + i * 230
    text(value, 90, y, 120, 800, '#ffffff')
    text(label, 90, y + 64, 40, 500, 'rgba(255,255,255,0.8)')
  })
  if (r.topPlace) {
    text(t('impact.storyTop'), 90, 1580, 36, 500, 'rgba(255,255,255,0.7)')
    text(r.topPlace.name, 90, 1640, 52, 800, '#fd8e16')
  }
  text(t('impact.storyFooter'), 90, 1820, 36, 600, 'rgba(255,255,255,0.75)')
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png'))
}

function Recap({ impact }: { impact: Impact }) {
  const { user } = useAuth()
  const [sharing, setSharing] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const r = impact.recap
  const max = Math.max(1, ...r.perMonth)
  const share = async () => {
    setSharing(true)
    setNote(null)
    try {
      const blob = await recapImage(impact, user?.name.split(' ')[0] ?? '')
      const file = new File([blob], `foodnesi-${r.year}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: t('impact.storyTitle', { year: r.year }), text: t('impact.shareText', { count: r.bags }) })
      } else {
        // Desktop: download the picture.
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 5_000)
        setNote(t('impact.downloaded'))
      }
    } catch {
      // Share sheet closed — nothing to do.
    } finally {
      setSharing(false)
    }
  }
  return (
    <Card className="overflow-hidden">
      <div className="space-y-4 bg-gradient-to-br from-primary to-primary/85 p-5 text-primary-foreground">
        <p className="flex items-center gap-2 text-sm font-semibold opacity-90">
          <CalendarHeart className="size-4" />
          {t('impact.recapTitle', { year: r.year })}
        </p>
        {r.bags === 0 ? (
          <p className="text-lg font-bold">{t('impact.recapEmpty')}</p>
        ) : (
          <>
            <p className="text-3xl font-extrabold">{t('impact.recapBags', { count: r.bags })}</p>
            <p className="text-sm opacity-90">
              {t('impact.recapLine', { kg: number(r.kgFood), co2: number(r.co2Kg), places: r.places })}
              {r.savings[0] && ` ${t('impact.recapSaved', { amount: formatMoney(r.savings[0].minor, r.savings[0].currency) })}`}
            </p>
            {r.topPlace && (
              <p className="text-sm">
                {t('impact.recapTop')} <strong>{r.topPlace.name}</strong> ({t('offer.bags', { count: r.topPlace.bags })})
              </p>
            )}
            {r.bestMonth && <p className="text-sm">{t('impact.recapBestMonth', { month: monthName(r.bestMonth) })}</p>}
            <div className="flex h-16 items-end gap-1" aria-hidden>
              {r.perMonth.map((n, i) => (
                <span key={i} className="flex-1 rounded-t bg-accent/90" style={{ height: `${Math.max(4, (n / max) * 100)}%`, opacity: n ? 1 : 0.3 }} />
              ))}
            </div>
          </>
        )}
      </div>
      {r.bags > 0 && (
        <div className="space-y-2 p-4">
          <Button className="w-full" onClick={share} disabled={sharing}>
            {sharing ? <Loader2 className="animate-spin" /> : <Share2 />}
            {t('impact.share')}
          </Button>
          {note && <p className="text-center text-xs text-muted-foreground">{note}</p>}
        </div>
      )}
    </Card>
  )
}

function ImpactView() {
  const { data, isLoading, isError, refetch } = useImpact()
  if (isLoading) return <Skeleton className="h-96 rounded-3xl" />
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />
  const saved = data.savings[0]
  const weekLeft = Math.max(0, data.week.goal - data.week.bags)
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={ShoppingBag} value={String(data.bags)} label={t('impact.bags')} />
        <Stat icon={Leaf} value={`${number(data.kgFood)} kg`} label={t('impact.food')} />
        <Stat icon={Cloud} value={`${number(data.co2Kg)} kg`} label={t('impact.co2')} />
        <Stat icon={PiggyBank} value={saved ? formatMoney(saved.minor, saved.currency) : '0'} label={t('impact.saved')} />
      </div>

      <Card className="space-y-3 p-5">
        <p className="flex items-center gap-2 font-bold">
          <Target className="size-5 text-primary" />
          {t('impact.weekTitle')}
        </p>
        <p className="text-sm text-muted-foreground">
          {data.week.done ? t('impact.weekDone', { bonus: data.week.bonus }) : t('impact.weekText', { count: weekLeft, bonus: data.week.bonus })}
        </p>
        <div className="flex gap-1.5" aria-label={t('impact.weekProgress', { bags: data.week.bags, goal: data.week.goal })}>
          {Array.from({ length: data.week.goal }, (_, i) => (
            <span key={i} className={cn('h-3 flex-1 rounded-full', i < data.week.bags ? 'bg-primary' : 'bg-muted')} />
          ))}
        </div>
      </Card>

      <Card className="flex items-center gap-4 p-5">
        <span className={cn('flex size-14 shrink-0 items-center justify-center rounded-2xl', data.streak.weeks ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>
          <Flame className="size-7" />
        </span>
        <div>
          <p className="text-lg font-extrabold">{t('impact.streak', { count: data.streak.weeks })}</p>
          <p className="text-sm text-muted-foreground">
            {t('impact.streakNext', { weeks: data.streak.nextAt - data.streak.weeks, bonus: data.streak.bonus })}
          </p>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-bold">
          <Sparkles className="size-5 text-accent-foreground" />
          {t('impact.badges')}
        </h2>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {data.badges.map((b) => {
            const Icon = BADGE_ICONS[b.key]
            return (
              <li key={b.key} className={cn('flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center', b.earned ? 'bg-secondary' : 'bg-muted/60 opacity-60')}>
                <span className={cn('flex size-11 items-center justify-center rounded-full', b.earned ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                  <Icon className="size-5" />
                </span>
                <span className="text-xs font-semibold">{t(`impact.badge.${b.key}` as MessageKey)}</span>
                <span className="text-[11px] leading-tight text-muted-foreground">{t(`impact.badgeHint.${b.key}` as MessageKey)}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <Recap impact={data} />
      <p className="text-center text-xs text-muted-foreground">{t('impact.estimate')}</p>
    </div>
  )
}

export function ImpactPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Button asChild variant="ghost" className="mb-3 -ml-3">
        <Link to="/profile">
          <ArrowLeft />
          {t('nav.profile')}
        </Link>
      </Button>
      <h1 className="mb-1 text-2xl font-extrabold">{t('impact.title')}</h1>
      <p className="mb-5 text-sm text-muted-foreground">{t('impact.intro')}</p>
      <RequireAuth>
        <ImpactView />
      </RequireAuth>
    </div>
  )
}
