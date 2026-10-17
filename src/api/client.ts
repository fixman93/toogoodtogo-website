import axios, { AxiosError } from 'axios'
import { localize } from '@/i18n'
import type { ApiErrorBody } from './types'

// Storage keys keep the pre-rename "zalogaj." prefix so nobody is signed out by the rename to Foodnesi.
const TOKEN_KEY = 'zalogaj.token'

/** Kept until sign-out (or until the session expires after a long time without use). */
export const tokenStorage = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* private mode / storage full: the session lasts until the tab is closed */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
  },
}

/** Normalized error thrown by every API call. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

/**
 * Same-origin "/api" by default: Vite proxies it in development and
 * vercel.json rewrites it to the Heroku API in production.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** 401 codes that mean the session itself is invalid (not e.g. "wrong password" in a form). */
const SESSION_ERRORS = new Set(['UNAUTHORIZED', 'INVALID_TOKEN', 'SESSION_EXPIRED', 'USER_NOT_FOUND'])

api.interceptors.response.use(
  (response) => {
    // Sliding session: the API sends a fresh token about once a day while the app is used.
    const renewed = response.headers['x-session-token']
    if (typeof renewed === 'string' && renewed && tokenStorage.get()) tokenStorage.set(renewed)
    return response
  },
  (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status ?? 0
    const body = error.response?.data?.error
    if (status === 401 && SESSION_ERRORS.has(body?.code ?? 'UNAUTHORIZED')) tokenStorage.clear()
    return Promise.reject(
      new ApiError(status, body?.code ?? (status ? 'HTTP_ERROR' : 'NETWORK_ERROR'), localize(body?.message ?? error.message), body?.details),
    )
  },
)
