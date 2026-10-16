import { cn } from '@/lib/utils'

/** The Foodnesi symbol (bag, fork and leaf) — public/brand/foodnesi-mark.png. Use it on light backgrounds. */
export function LogoMark({ className }: { className?: string }) {
  return <img src="/brand/foodnesi-mark.png" alt="" aria-hidden="true" width={36} height={36} className={cn('size-9 object-contain', className)} />
}

/** Symbol + wordmark in the logo's colours ("Food" dark green, "nesi" leaf green). */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <LogoMark />
      <span className="text-xl font-extrabold tracking-tight" aria-label="Foodnesi">
        <span className="text-primary">Food</span>
        <span className="text-brand-leaf">nesi</span>
      </span>
    </span>
  )
}
