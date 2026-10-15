import type { ReactNode } from 'react'
import { Link, useLocation as useRouterLocation } from 'react-router'
import { LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { t } from '@/i18n'
import { EmptyState } from './StateViews'

/** Renders children for signed-in users, otherwise a friendly login prompt. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useRouterLocation()
  if (isLoading) return null
  if (!user) {
    return (
      <EmptyState
        icon={LogIn}
        title={t('auth.required')}
        text={t('auth.requiredText')}
        action={
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/login" state={{ from: location.pathname }}>
                {t('auth.login')}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/register" state={{ from: location.pathname }}>
                {t('auth.register')}
              </Link>
            </Button>
          </div>
        }
      />
    )
  }
  return <>{children}</>
}
