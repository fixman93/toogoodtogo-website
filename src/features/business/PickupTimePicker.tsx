import { Minus, Plus, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

const STEP = 15
const DURATIONS = [30, 60, 90, 120, 180]
const COMMON_STARTS = ['08:00', '12:00', '16:00', '18:00', '19:00', '20:00']

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
const fmt = (minutes: number) => {
  const m = Math.max(0, Math.min(23 * 60 + 59, minutes))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
/** Next quarter hour after `hhmm` ("17:08" → "17:15"). */
const roundUpQuarter = (hhmm: string) => fmt(Math.ceil(toMin(hhmm) / STEP) * STEP)

const durationLabel = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`
}

/** Big −/+ around a native time field (tap the time to type or use the system picker). */
function TimeStepper({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const shift = (delta: number) => onChange(fmt(toMin(value) + delta))
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-sm font-semibold text-muted-foreground">{label}</span>
      <Button type="button" variant="outline" size="icon" className="size-12 shrink-0 rounded-full" aria-label={t('time.minus15', { label })} onClick={() => shift(-STEP)}>
        <Minus />
      </Button>
      <input
        type="time"
        step={STEP * 60}
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        aria-label={label}
        className="h-12 min-w-0 flex-1 rounded-2xl border bg-card px-3 text-center text-2xl font-extrabold tabular-nums [&::-webkit-date-and-time-value]:text-center [&::-webkit-datetime-edit]:mx-auto [&::-webkit-datetime-edit]:w-fit"
      />
      <Button type="button" variant="outline" size="icon" className="size-12 shrink-0 rounded-full" aria-label={t('time.plus15', { label })} onClick={() => shift(STEP)}>
        <Plus />
      </Button>
    </div>
  )
}

/**
 * Fast pickup window entry for phones/tablets: start chips ("Odmah", recent and
 * common times), duration chips, and ±15 min steppers. Moving the start keeps
 * the duration, so the end follows by itself.
 */
export function PickupTimePicker({
  from,
  to,
  onChange,
  recent = [],
  now,
}: {
  from: string
  to: string
  onChange: (v: { from: string; to: string }) => void
  /** Start times this location used before (first = most recent). */
  recent?: string[]
  /** Current local time when the pickup is today ("Odmah" + past times disabled); omit otherwise. */
  now?: string
}) {
  const duration = toMin(to) - toMin(from)
  const keepDuration = (start: string) => onChange({ from: start, to: fmt(toMin(start) + (duration > 0 ? duration : 90)) })
  const starts = [...new Set([...recent, ...COMMON_STARTS])].sort().slice(0, 8)
  const asap = now ? roundUpQuarter(now) : null

  return (
    <div className="space-y-3">
      <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={t('time.startChips')}>
        {asap && (
          <button
            type="button"
            onClick={() => keepDuration(asap)}
            className={cn('flex h-10 shrink-0 items-center gap-1 rounded-full border px-3 text-sm font-semibold', from === asap ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}
          >
            <Zap className="size-4" />
            {t('time.now')}
          </button>
        )}
        {starts.map((s) => {
          const past = !!now && toMin(s) + Math.max(duration, STEP) <= toMin(now)
          return (
            <button
              key={s}
              type="button"
              disabled={past}
              onClick={() => keepDuration(s)}
              className={cn(
                'h-10 shrink-0 rounded-full border px-3 text-sm font-semibold tabular-nums disabled:opacity-35',
                from === s ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
                recent.includes(s) && from !== s && 'border-primary/40',
              )}
            >
              {s}
            </button>
          )
        })}
      </div>

      <TimeStepper label={t('quick.from')} value={from} onChange={keepDuration} />

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('time.duration')}>
        {DURATIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange({ from, to: fmt(toMin(from) + d) })}
            className={cn('h-10 min-w-16 flex-1 rounded-full border px-2 text-sm font-semibold', duration === d ? 'border-primary bg-secondary text-primary' : 'bg-card')}
          >
            {durationLabel(d)}
          </button>
        ))}
      </div>

      <TimeStepper label={t('quick.to')} value={to} onChange={(v) => onChange({ from, to: v })} />

      {duration > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          {t('time.summary', { from, to, duration: durationLabel(duration) })}
        </p>
      )}
    </div>
  )
}
