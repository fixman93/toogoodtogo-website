/**
 * Typed functions for every REST endpoint. Screens only talk to these (via
 * the hooks in src/hooks), so swapping mock ↔ real backend is a config change.
 */
import { api } from './client'
import type {
  ApiList,
  ApiSuccess,
  AuthResult,
  Business,
  Favorite,
  FavoriteTarget,
  Offer,
  OfferQuery,
  Reservation,
  Review,
  User,
} from './types'

const unwrap = <T>(promise: Promise<{ data: ApiSuccess<T> }>) => promise.then((res) => res.data.data)

export const authApi = {
  login: (body: { email: string; password: string }) => unwrap<AuthResult>(api.post('/auth/login', body)),
  register: (body: { name: string; email: string; password: string }) =>
    unwrap<AuthResult>(api.post('/auth/register', body)),
  me: () => unwrap<User>(api.get('/auth/me')),
}

export const offersApi = {
  list: (params: OfferQuery = {}) => api.get<ApiList<Offer>>('/offers', { params }).then((res) => res.data),
  get: (id: string) => unwrap<Offer>(api.get(`/offers/${id}`)),
}

export const businessesApi = {
  list: (params: { owner?: 'me'; city?: string } = {}) =>
    api.get<ApiList<Business>>('/businesses', { params }).then((res) => res.data),
  get: (id: string) => unwrap<Business>(api.get(`/businesses/${id}`)),
  reviews: (id: string) => api.get<ApiList<Review>>(`/businesses/${id}/reviews`).then((res) => res.data),
  addReview: (id: string, body: { reservationId: string; rating: number; comment?: string }) =>
    unwrap<Review>(api.post(`/businesses/${id}/reviews`, body)),
}

export const reservationsApi = {
  list: (params: { scope?: 'upcoming' | 'history'; businessId?: string; limit?: number } = {}) =>
    api.get<ApiList<Reservation>>('/reservations', { params }).then((res) => res.data),
  get: (id: string) => unwrap<Reservation>(api.get(`/reservations/${id}`)),
  create: (body: { offerId: string; quantity: number }) => unwrap<Reservation>(api.post('/reservations', body)),
  cancel: (id: string) => unwrap<Reservation>(api.patch(`/reservations/${id}/cancel`)),
  /** Business staff: hand over by id (from the list). */
  collect: (id: string) => unwrap<Reservation>(api.patch(`/reservations/${id}/collect`)),
  /** Business staff: hand over by scanned QR (code + id) or a typed code. */
  collectByCode: (body: { code: string; reservationId?: string }) => unwrap<Reservation>(api.post('/reservations/collect', body)),
}

export const favoritesApi = {
  list: () => api.get<ApiList<Favorite>>('/favorites').then((res) => res.data),
  add: (body: { targetType: FavoriteTarget; targetId: string }) => unwrap<Favorite>(api.post('/favorites', body)),
  remove: (id: string) => api.delete(`/favorites/${id}`).then(() => undefined),
}
