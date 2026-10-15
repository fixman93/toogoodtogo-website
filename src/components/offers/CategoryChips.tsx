import { LayoutGrid } from 'lucide-react'
import { CATEGORIES, type Category } from '@/api/types'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { CATEGORY_ICONS } from './categories'

export function CategoryChips({
  value,
  onChange,
  className,
}: {
  value?: Category
  onChange: (value: Category | undefined) => void
  className?: string
}) {
  const options: { id?: Category; label: string; Icon: typeof LayoutGrid }[] = [
    { id: undefined, label: t('category.all'), Icon: LayoutGrid },
    ...CATEGORIES.map((id) => ({ id, label: t(`category.${id}`), Icon: CATEGORY_ICONS[id] })),
  ]
  return (
    <div className={cn('scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0', className)} role="radiogroup">
      {options.map(({ id, label, Icon }) => {
        const active = value === id
        return (
          <button
            key={id ?? 'all'}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(id)}
            className={cn(
              'flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors',
              active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
