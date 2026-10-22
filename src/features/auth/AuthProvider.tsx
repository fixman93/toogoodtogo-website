import { useCallback, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { tokenStorage } from '@/api/client'
import { authApi } from '@/api/services'
import { LEGAL_VERSIONS } from '@/config/legal'
import { market } from '@/config/markets'
import type { AuthResult, Role } from '@/api/types'
import { AuthContext, ME_QUERY_KEY, type AuthContextValue } from './auth-context'

/** JWT bearer auth: token in localStorage, user profile cached by TanStack Query. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data: user = null, isLoading } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => (tokenStorage.get() ? authApi.me() : null),
    // Roles can be changed by an admin at any time; pick that up on focus.
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  })

  const onAuthenticated = useCallback(
    ({ token, user }: AuthResult) => {
      tokenStorage.set(token)
      // Drop user-specific data cached for the previous session. Never remove the
      // `me` query itself: this provider observes it, so we update it in place.
      queryClient.removeQueries({ queryKey: ['reservations'] })
      queryClient.removeQueries({ queryKey: ['favorites'] })
      queryClient.setQueryData(ME_QUERY_KEY, user)
      // Fetch the full profile (points, level, invite code) in the background.
      void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY })
      return user
    },
    [queryClient],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      login: (email, password) => authApi.login({ email, password }).then(onAuthenticated),
      resetPassword: (token, password) => authApi.resetPassword({ token, password }).then(onAuthenticated),
      register: ({ acceptTerms, ...input }) =>
        authApi
          .register({ ...input, countryCode: market.code, acceptTerms, termsVersion: LEGAL_VERSIONS.terms, privacyVersion: LEGAL_VERSIONS.privacy })
          .then(onAuthenticated),
      logout: () => {
        tokenStorage.clear()
        queryClient.setQueryData(ME_QUERY_KEY, null)
        queryClient.removeQueries({ queryKey: ['reservations'] })
        queryClient.removeQueries({ queryKey: ['favorites'] })
      },
      hasRole: (...roles: Role[]) => !!user && roles.includes(user.role),
      can: (permission) => !!user?.permissions?.includes(permission),
    }),
    [user, isLoading, onAuthenticated, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
