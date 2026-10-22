import { createContext, useContext } from 'react'
import type { Permission, Role, User } from '@/api/types'

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => void
  /** Sets a new password from an e-mailed link and signs the user in. */
  resetPassword: (token: string, password: string) => Promise<User>
  hasRole: (...roles: Role[]) => boolean
  /** Platform permission (admin panel). */
  can: (permission: Permission) => boolean
  /** `acceptTerms`: the terms checkbox (also checked by the API). */
  register: (input: { name: string; email: string; password: string; phone: string; referralCode?: string; acceptTerms: boolean }) => Promise<User>
}

export const ME_QUERY_KEY = ['auth', 'me'] as const

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
