import { useState } from 'react'
import { Leaf, TrendingDown, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { market } from '@/config/markets'
import { activeLocale, t } from '@/i18n'
import { cn } from '@/lib/utils'
import { LOSS_ASSUMPTIONS, defaultDailyValue, estimateLoss, formatWhole, rangeFor, type BusinessKind } from './loss'

const KINDS: BusinessKind[] = ['bakery', 'meals', 'groceries', 'sweets']
const DAYS = [5, 6, 7]

/** "How much do you throw away?" calculator for the partner page, in the visitor's market currency. */
export function LossCalculator() {
  const currency = market.currency
  const range = rangeFor(currency)
  const [kind, setKind] = useState<BusinessKind>('bakery')
  const [daily, setDaily] = useState(() => defaultDailyValue(currency, 'bakery'))
  const [days, setDays] = useState(6)
  const money = (amount: number) => formatWhole(amount, currency, activeLocale)
  const result = estimateLoss(currency, daily, days)
  const percent = (value: number) => Math.round(value * 100)

  const pickKind = (next: BusinessKind) => {
    setKind(next)
    setDaily(defaultDailyValue(currency, next))
  }

  return (
    <Card className="grid overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-6 p-5 sm:p-7">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{t('pitch.calcTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('pitch.calcText')}</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">{t('pitch.kindLabel')}</legend>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => pickKind(k)}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                  kind === k ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/50',
                )}
              >
                {t(`pitch.kind.${k}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <label htmlFor="pitch-daily" className="text-sm font-semibold">
              {t('pitch.dailyLabel')}
            </label>
            <output htmlFor="pitch-daily" className="shrink-0 text-xl font-extrabold tabular-nums">
              {money(daily)}
            </output>
          </div>
          <input
            id="pitch-daily"
            type="range"
            min={range.min}
            max={range.max}
            step={range.step}
            value={daily}
            onChange={(e) => setDaily(Number(e.target.value))}
            className="h-2 w-full cursor-pointer accent-[var(--brand-orange-deep)]"
          />
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>{money(range.min)}</span>
            <span>{money(range.max)}</span>
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t('pitch.daysLabel')}</legend>
          <div className="inline-grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days === d}
                onClick={() => setDays(d)}
                className={cn('min-w-14 rounded-lg px-4 py-2 text-sm font-bold tabular-nums', days === d ? 'bg-card shadow-card' : 'text-muted-foreground')}
              >
                {d}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex flex-col gap-4 bg-muted/60 p-5 sm:p-7" aria-live="polite">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/8 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <TrendingDown className="size-4" />
            {t('pitch.lossMonthly')}
          </p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight text-destructive tabular-nums sm:text-5xl">{money(result.monthlyLoss)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('pitch.lossYearly', { amount: money(result.yearlyLoss) })}</p>
        </div>

        <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary-foreground/80">
            <TrendingUp className="size-4" />
            {t('pitch.gainMonthly')}
          </p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl">+{money(result.monthlyNet)}</p>
          <p className="mt-1 text-sm text-primary-foreground/80">
            {t('pitch.gainYearly', { amount: money(result.yearlyNet) })} · {t('pitch.bagsPerDay', { count: result.bagsPerDay })}
          </p>
        </div>

        <p className="flex items-start gap-2 text-sm font-medium">
          <Leaf className="mt-0.5 size-4 shrink-0 text-brand-leaf" />
          {t('pitch.saved', { kg: result.kgFood, co2: result.co2Kg })}
        </p>
        <p className="mt-auto text-xs text-muted-foreground">
          {t('pitch.assumptions', { sell: percent(LOSS_ASSUMPTIONS.sellThrough), rate: percent(LOSS_ASSUMPTIONS.commissionRate) })}
        </p>
      </div>
    </Card>
  )
}
