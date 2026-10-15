import { cn } from '@/lib/utils'
import { t } from '@/i18n'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('size-9', className)}>
      <rect width="64" height="64" rx="18" fill="var(--primary)" />
      <path
        d="M32 12c-11 0-20 9-20 20s9 20 20 20 20-9 20-20c0-1.2-.1-2.3-.3-3.4a7 7 0 0 1-9.3-8.3A7 7 0 0 1 35 12.3c-1-.2-2-.3-3-.3Z"
        fill="var(--accent)"
      />
      <path d="M24 38c5-1 10-6 12-13-6 2-11 6-12 13Z" fill="var(--primary)" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <LogoMark />
      <span className="text-xl font-extrabold tracking-tight text-primary">{t('brand.name')}</span>
    </span>
  )
}
