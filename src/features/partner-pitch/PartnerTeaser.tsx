import { Link } from 'react-router'
import { ArrowRight, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { market } from '@/config/markets'
import { useAuth } from '@/features/auth/auth-context'
import { activeLocale, t } from '@/i18n'
import { defaultDailyValue, estimateLoss, formatWhole } from './loss'

/** Home page band for business owners: a typical bakery's monthly loss, linking to the calculator. */
export function PartnerTeaser() {
  const { hasRole } = useAuth()
  if (hasRole('business', 'admin')) return null

  const daily = defaultDailyValue(market.currency, 'bakery')
  const { monthlyLoss } = estimateLoss(market.currency, daily, 6)
  const money = (amount: number) => formatWhole(amount, market.currency, activeLocale)

  return (
    <section className="relative overflow-hidden rounded-3xl bg-foreground p-6 text-background sm:p-8">
      <div className="absolute -right-20 -bottom-24 size-64 rounded-full bg-accent/30 blur-3xl" aria-hidden />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <p className="flex items-center gap-2 text-xs font-bold tracking-widest text-accent uppercase">
            <Store className="size-4" />
            {t('pitch.teaserEyebrow')}
          </p>
          <h2 className="mt-2 text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl">{t('pitch.teaserTitle')}</h2>
          <p className="mt-2 text-sm text-background/75 sm:text-base">{t('pitch.teaserText', { daily: money(daily), monthly: money(monthlyLoss) })}</p>
        </div>
        <Button asChild size="lg" className="shrink-0 bg-accent text-accent-foreground hover:bg-accent/90">
          <Link to="/partner/apply#kalkulator">
            {t('pitch.teaserCta')}
            <ArrowRight />
          </Link>
        </Button>
      </div>
    </section>
  )
}
