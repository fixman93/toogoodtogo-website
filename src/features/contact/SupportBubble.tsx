import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { MessageCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { ContactForm } from './ContactForm'

/** Pages with their own form, a full-screen tool, or a QR to show at the counter. */
const HIDDEN = [/^\/kontakt/, /^\/support/, /^\/business\/scan/, /^\/business\/counter/, /^\/business\/deliveries\//, /^\/pickup\//]
const isPhone = () => window.matchMedia('(max-width: 639px)').matches

/**
 * Floating "Piši podršci" bubble (bottom right). Phones: a bottom sheet above the tab bar;
 * larger screens: a small panel. Sends through the same contact form (e-mail to the team).
 */
export function SupportBubble() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const [openState, setOpen] = useState(false)
  // Pages without the bubble: treated as closed (no scroll lock behind a hidden sheet).
  const hidden = HIDDEN.some((rx) => rx.test(pathname))
  const open = openState && !hidden
  /** Mounted after the first open, so a draft survives closing. */
  const [mounted, setMounted] = useState(false)
  /** New form after a sent message. */
  const [formKey, setFormKey] = useState(0)
  const [sent, setSent] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const firstField = useRef<HTMLTextAreaElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const panelId = useId()

  const close = () => {
    setOpen(false)
    if (sent) {
      setSent(false)
      setFormKey((k) => k + 1)
    }
    button.current?.focus()
  }

  // Esc closes; on phones the page behind the sheet doesn't scroll.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    const lock = isPhone()
    if (lock) document.body.style.overflow = 'hidden'
    // Phones: focus the panel, not the field — the keyboard would cover half the sheet right away.
    const focus = window.setTimeout(() => (lock ? panel.current : firstField.current)?.focus({ preventScroll: true }), 50)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (lock) document.body.style.overflow = ''
      window.clearTimeout(focus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (hidden) return null

  // Offer page on phones/tablets: the reservation bar sits where the bubble would be.
  const hideOnSmall = pathname.startsWith('/offers/')

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" aria-hidden="true" onClick={close} />}

      {mounted && (
        <div
          ref={panel}
          tabIndex={-1}
          id={panelId}
          role="dialog"
          aria-labelledby={titleId}
          aria-modal={open || undefined}
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden border bg-card shadow-2xl outline-none print:hidden',
            // Phones: bottom sheet. Larger: panel above the bubble (the tab bar is shown up to md).
            'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl',
            'sm:inset-x-auto sm:right-4 sm:bottom-[calc(4rem+env(safe-area-inset-bottom)+5rem)] sm:max-h-[calc(100dvh-10rem)] sm:w-[380px] sm:rounded-3xl',
            'md:right-6 md:bottom-24 md:max-h-[calc(100dvh-8rem)]',
            !open && 'hidden',
          )}
        >
          <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted sm:hidden" aria-hidden="true" />
          <div className="flex shrink-0 items-start gap-3 border-b px-5 pt-3 pb-3 sm:pt-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <MessageCircle className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="font-bold">
                {t('bubble.title')}
              </h2>
              <p className="text-xs text-muted-foreground">{t('bubble.subtitle')}</p>
            </div>
            <Button variant="ghost" size="icon" className="-mr-2 shrink-0" onClick={close} aria-label={t('bubble.close')}>
              <X />
            </Button>
          </div>
          <div className="overflow-y-auto overscroll-contain px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5">
            <ContactForm
              key={formKey}
              compact
              idPrefix="bubble"
              defaultTopic={user?.role === 'business' || user?.role === 'staff' ? 'partnership' : 'support'}
              firstFieldRef={firstField}
              onSent={() => setSent(true)}
              sentAction={
                <Button variant="outline" onClick={close}>
                  {t('bubble.close')}
                </Button>
              }
            />
            {user && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {t('bubble.reservationHint')}{' '}
                <Link to="/support" onClick={close} className="font-semibold text-primary underline">
                  {t('profile.support')}
                </Link>
              </p>
            )}
          </div>
        </div>
      )}

      <button
        ref={button}
        type="button"
        aria-label={open ? t('bubble.close') : t('bubble.open')}
        aria-expanded={open}
        aria-controls={mounted ? panelId : undefined}
        onClick={() => {
          if (open) return close()
          setMounted(true)
          setOpen(true)
        }}
        className={cn(
          'fixed right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none active:scale-95 print:hidden',
          // Above the tab bar on phones; corner on larger screens.
          'bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] md:right-6 md:bottom-6',
          open && 'max-sm:hidden',
          hideOnSmall && 'max-lg:hidden',
        )}
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </>
  )
}
