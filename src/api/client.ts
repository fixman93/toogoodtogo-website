import axios, { AxiosError, type AxiosAdapter } from 'axios'
import type { ApiErrorBody } from './types'

/** "mock" (default until the backend is deployed) or "http". */
export const API_MODE = import.meta.env.VITE_API_MODE ?? 'mock'
export const isMockMode = API_MODE === 'mock'

const TOKEN_KEY = 'zalogaj.token'

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
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
 * In mock mode requests never leave the browser: a lazily loaded adapter
 * answers them with the same JSON envelopes the Express API returns.
 */
const mockAdapter: AxiosAdapter = async (config) => {
  const { handleMockRequest } = await import('@/mocks/adapter')
  return handleMockRequest(config)
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
  ...(isMockMode ? { adapter: mockAdapter } : {}),
})

api.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status ?? 0
    const body = error.response?.data?.error
    if (status === 401) tokenStorage.clear()
    return Promise.reject(
      new ApiError(status, body?.code ?? (status ? 'HTTP_ERROR' : 'NETWORK_ERROR'), body?.message ?? error.message, body?.details),
    )
  },
)
