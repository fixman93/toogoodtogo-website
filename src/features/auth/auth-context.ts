import { createContext, useContext } from 'react'
import type { Role, User } from '@/api/types'

export interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (name: string, email: string, password: string) => Promise<User>
  logout: () => void
  hasRole: (...roles: Role[]) => boolean
}

export const ME_QUERY_KEY = ['auth', 'me'] as const

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
