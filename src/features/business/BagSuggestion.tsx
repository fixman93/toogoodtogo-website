import { Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBagSuggestion } from '@/hooks/api'
import { t, type MessageKey } from '@/i18n'
import { suggestedFor, weekdayShort } from './weekdays'
import { cn } from '@/lib/utils'

/**
 * "Utorkom prodaš u proseku 8 od 10 kesa → preporuka 10", from the last weeks'
 * sales of this location, with a button that applies it.
 */
export function SuggestionHint({ businessId, weekdays, quantity, onApply }: { businessId: string; weekdays: number[]; quantity: number; onApply: (n: number) => void }) {
  const { data } = useBagSuggestion(businessId)
  const days = (data?.days ?? []).filter((d) => weekdays.includes(d.weekday) && d.days > 0)
  const suggested = suggestedFor(data, weekdays)
  if (!data) return null
  if (!days.length || suggested == null) {
    return <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-xs text-muted-foreground">{t('suggest.noData')}</p>
  }
  const one = days.length === 1 ? days[0] : null
  return (
    <div className="flex items-start gap-2 rounded-xl bg-accent/20 p-3 text-sm">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent-foreground" />
      <div className="min-w-0 flex-1 space-y-1">
        <p>
          {one
            ? t(one.soldOutDays === one.days ? 'suggest.soldOutAlways' : 'suggest.one', {
                day: t(`weekday.on.${one.weekday}` as MessageKey),
                sold: String(one.avgSold ?? 0).replace('.', ','),
                offered: String(one.avgOffered ?? 0).replace('.', ','),
              })
            : t('suggest.many', { count: days.length })}{' '}
          <strong>{t('suggest.value', { count: suggested })}</strong>
        </p>
        {suggested !== quantity && (
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => onApply(suggested)}>
            {t('suggest.apply', { count: suggested })}
          </Button>
        )}
      </div>
    </div>
  )
}

/** Per-weekday table (Ponavljajuće ponude page). */
export function SuggestionTable({ businessId }: { businessId: string }) {
  const { data } = useBagSuggestion(businessId)
  if (!data) return null
  if (!data.days.some((d) => d.days > 0)) return <p className="text-sm text-muted-foreground">{t('suggest.noData')}</p>
  return (
    <div className="grid grid-cols-7 gap-1 text-center text-xs">
      {data.days.map((d) => (
        <div key={d.weekday} className={cn('rounded-lg p-1.5', d.days ? 'bg-muted' : 'opacity-50')}>
          <p className="font-semibold">{weekdayShort(d.weekday)}</p>
          <p className="text-muted-foreground">{d.days ? `${String(d.avgSold).replace('.', ',')}/${String(d.avgOffered).replace('.', ',')}` : '–'}</p>
          <p className="text-base font-extrabold text-primary">{d.suggested ?? '–'}</p>
        </div>
      ))}
    </div>
  )
}
