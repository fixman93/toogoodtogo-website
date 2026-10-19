import fullLogoLight from '@/assets/images/web/foodnesi-logo-full-light.png'
import fullLogo from '@/assets/images/web/foodnesi-logo-full.png'
import symbol from '@/assets/images/web/foodnesi-symbol.png'
import wordmarkLight from '@/assets/images/web/foodnesi-wordmark-light.png'
import wordmark from '@/assets/images/web/foodnesi-wordmark.png'
import { cn } from '@/lib/utils'

/** The Foodnesi symbol ("OD" with the leaf) — app icon style, for small spots. */
export function LogoMark({ className }: { className?: string }) {
  return <img src={symbol} alt="" aria-hidden="true" width={36} height={36} className={cn('size-9 object-contain', className)} />
}

/** "foODnesi" wordmark (header). `light` = cream letters for dark backgrounds. */
export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return <img src={light ? wordmarkLight : wordmark} alt="Foodnesi" width={480} height={140} className={cn('h-9 w-auto', className)} />
}

/** Wordmark with the slogan "Dobra hrana. Manje otpada." (sign-in, splash-like spots). */
export function LogoFull({ className, light }: { className?: string; light?: boolean }) {
  return <img src={light ? fullLogoLight : fullLogo} alt="Foodnesi – dobra hrana, manje otpada" width={720} height={252} className={cn('h-16 w-auto', className)} />
}
