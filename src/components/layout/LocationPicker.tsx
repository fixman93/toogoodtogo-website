import { useState } from 'react'
import { Check, ChevronDown, LocateFixed, Loader2, MapPin } from 'lucide-react'
import { Sheet } from '@/components/common/Sheet'
import { market } from '@/config/markets'
import { useLocation } from '@/features/location/location-context'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

export function LocationPicker({ className }: { className?: string }) {
  const { location, setCity, locateDevice, isLocating, error } = useLocation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('flex min-h-11 items-center gap-2 rounded-full px-2 text-left hover:bg-muted', className)}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-secondary">
          <MapPin className="size-4 text-primary" />
        </span>
        <span className="leading-tight">
          <span className="block text-[11px] font-medium text-muted-foreground">{t('location.label')}</span>
          <span className="flex items-center gap-1 text-sm font-bold">
            {location.label}
            <ChevronDown className="size-4" />
          </span>
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('location.label')}>
        <button
          type="button"
          disabled={isLocating}
          onClick={async () => {
            if (await locateDevice()) setOpen(false)
          }}
          className="mb-3 flex h-12 w-full items-center gap-3 rounded-xl bg-secondary px-4 font-semibold text-secondary-foreground"
        >
          {isLocating ? <Loader2 className="size-5 animate-spin" /> : <LocateFixed className="size-5" />}
          {isLocating ? t('location.locating') : t('location.useMine')}
        </button>
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        <ul className="divide-y rounded-xl border">
          {market.cities.map((city) => (
            <li key={city.id}>
              <button
                type="button"
                onClick={() => {
                  setCity(city.id)
                  setOpen(false)
                }}
                className="flex h-12 w-full items-center justify-between px-4 text-left font-medium hover:bg-muted"
              >
                {city.name}
                {location.source === city.id && <Check className="size-5 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  )
}
