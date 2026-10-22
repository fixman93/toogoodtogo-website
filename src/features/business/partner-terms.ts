import { useAuth } from '@/features/auth/auth-context'

/** Partner owner who still has to accept the partner rules: no new offers or locations until then. */
export function usePartnerTermsPending() {
  const { user, hasRole } = useAuth()
  return hasRole('business') && !!user?.legal?.partnerTermsNeedsAcceptance
}
