import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { RequireAuth } from '@/components/common/RequireAuth'
import { EmptyState } from '@/components/common/StateViews'
import { useAuth } from '@/features/auth/auth-context'
import { t } from '@/i18n'

/** Signed-in business/admin accounts only. The API enforces the same rule. */
export function PartnerGuard({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RoleCheck>{children}</RoleCheck>
    </RequireAuth>
  )
}

function RoleCheck({ children }: { children: ReactNode }) {
  const { hasRole } = useAuth()
  if (!hasRole('business', 'admin')) return <EmptyState icon={Lock} title={t('business.noAccess')} />
  return <>{children}</>
}
