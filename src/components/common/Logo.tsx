import symbol from '@/assets/images/web/foodnesi-symbol.png'
import wordmarkLight from '@/assets/images/web/foodnesi-wordmark-light.png'
import wordmark from '@/assets/images/web/foodnesi-wordmark.png'
import { cn } from '@/lib/utils'

/** The Foodnesi symbol (the orange fruit "O" with its leaves) — app icon style, for small spots. */
export function LogoMark({ className }: { className?: string }) {
  return <img src={symbol} alt="" aria-hidden="true" width={36} height={36} className={cn('size-9 object-contain', className)} />
}

/** "Foodnesi" wordmark (header). `light` = cream letters for dark backgrounds. */
export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return <img src={light ? wordmarkLight : wordmark} alt="Foodnesi" width={720} height={161} className={cn('h-9 w-auto', className)} />
}

/** Larger wordmark for sign-in and splash-like spots. */
export function LogoFull({ className, light }: { className?: string; light?: boolean }) {
  return <img src={light ? wordmarkLight : wordmark} alt="Foodnesi – dobra hrana, manje otpada" width={720} height={161} className={cn('h-12 w-auto', className)} />
}
