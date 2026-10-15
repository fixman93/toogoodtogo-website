import { Link, NavLink, Outlet, useLocation as useRouterLocation } from 'react-router'
import { useEffect } from 'react'
import { Logo } from '@/components/common/Logo'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { LocationPicker } from './LocationPicker'
import { NAV_ITEMS } from './nav-items'

function ScrollToTop() {
  const { pathname } = useRouterLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export function AppShell() {
  return (
    <div className="min-h-dvh">
      <ScrollToTop />
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="hidden shrink-0 md:block" aria-label={t('brand.name')}>
            <Logo />
          </Link>
          <LocationPicker className="-ml-2 md:ml-2" />
          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Glavna navigacija">
            {NAV_ITEMS.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors',
                    isActive ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <Icon className="size-4" />
                {t(label)}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto md:ml-0">
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-5 pb-28 md:pb-16">
        <Outlet />
      </main>

      <nav
        aria-label="Glavna navigacija"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/95 pb-safe backdrop-blur-lg md:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV_ITEMS.map(({ to, label, Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', isActive && 'bg-secondary')}>
                      <Icon className="size-5" strokeWidth={isActive ? 2.4 : 2} />
                    </span>
                    {t(label)}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
