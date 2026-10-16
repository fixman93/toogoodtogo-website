import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'

/** Password field with a show/hide toggle (eye icon). */
function PasswordInput({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = React.useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} className={cn('pr-12', className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        aria-pressed={visible}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none"
      >
        {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  )
}

export { PasswordInput }
