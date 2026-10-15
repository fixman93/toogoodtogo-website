import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import type { Role } from '@/api/types'
import { RequireAuth } from '@/components/common/RequireAuth'
import { EmptyState } from '@/components/common/StateViews'
import { useAuth } from '@/features/auth/auth-context'
import { t } from '@/i18n'

/** Renders children only for signed-in users with one of `roles`. The API enforces the same rule. */
export function RoleGuard({ roles, deniedText, children }: { roles: Role[]; deniedText: string; children: ReactNode }) {
  return (
    <RequireAuth>
      <RoleCheck roles={roles} deniedText={deniedText}>
        {children}
      </RoleCheck>
    </RequireAuth>
  )
}

function RoleCheck({ roles, deniedText, children }: { roles: Role[]; deniedText: string; children: ReactNode }) {
  const { hasRole } = useAuth()
  if (!hasRole(...roles)) return <EmptyState icon={Lock} title={deniedText} />
  return <>{children}</>
}

/** Business partners and admins. */
export function PartnerGuard({ children }: { children: ReactNode }) {
  return (
    <RoleGuard roles={['business', 'admin']} deniedText={t('business.noAccess')}>
      {children}
    </RoleGuard>
  )
}
