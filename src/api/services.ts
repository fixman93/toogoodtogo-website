/**
 * Typed functions for every REST endpoint. Screens only talk to these (via
 * the hooks in src/hooks), so swapping mock ↔ real backend is a config change.
 */
import { api } from './client'
import type {
  AdminBusiness,
  AdminReview,
  AppNotification,
  ApplicationStatus,
  AuditEntry,
  PartnerApplication,
  PartnerApplicationInput,
  PickupPass,
  ReservationStatus,
  AdminStats,
  AdminUser,
  ApiList,
  ApiSuccess,
  AuthResult,
  Business,
  BoundingBox,
  BusinessInput,
  Favorite,
  FavoriteTarget,
  Offer,
  OfferFilters,
  OfferInput,
  OfferLocation,
  OfferPatch,
  OfferQuery,
  Reservation,
  Review,
  Role,
  SalesReport,
  User,
} from './types'

const unwrap = <T>(promise: Promise<{ data: ApiSuccess<T> }>) => promise.then((res) => res.data.data)

export const authApi = {
  login: (body: { email: string; password: string }) => unwrap<AuthResult>(api.post('/auth/login', body)),
  register: (body: { name: string; email: string; password: string }) =>
    unwrap<AuthResult>(api.post('/auth/register', body)),
  me: () => unwrap<User>(api.get('/auth/me')),
  deleteAccount: (password: string) => api.delete('/auth/me', { data: { password } }).then(() => undefined),
}

export const offersApi = {
  list: (params: OfferQuery = {}) => api.get<ApiList<Offer>>('/offers', { params }).then((res) => res.data),
  get: (id: string) => unwrap<Offer>(api.get(`/offers/${id}`)),
  /** Map pins for the visible area — one per location, at any zoom level. */
  locations: (params: OfferFilters & BoundingBox) => unwrap<OfferLocation[]>(api.get('/offers/locations', { params })),
  create: (body: OfferInput) => unwrap<Offer>(api.post('/offers', body)),
  update: (id: string, body: OfferPatch) => unwrap<Offer>(api.patch(`/offers/${id}`, body)),
  remove: (id: string) => api.delete(`/offers/${id}`).then(() => undefined),
}

export const businessesApi = {
  list: (params: { owner?: 'me'; city?: string; sort?: 'name' | 'new'; limit?: number } = {}) =>
    api.get<ApiList<Business>>('/businesses', { params }).then((res) => res.data),
  get: (id: string) => unwrap<Business>(api.get(`/businesses/${id}`)),
  create: (body: BusinessInput) => unwrap<Business>(api.post('/businesses', body)),
  update: (id: string, body: Partial<BusinessInput>) => unwrap<Business>(api.patch(`/businesses/${id}`, body)),
  remove: (id: string) => api.delete(`/businesses/${id}`).then(() => undefined),
  /** Partner view: every offer of the location, including paused and past ones. */
  offers: (id: string) => api.get<ApiList<Offer>>(`/businesses/${id}/offers`).then((res) => res.data),
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
  /** Secret link a friend can use to pick the bag up. */
  share: (id: string) => unwrap<{ token: string }>(api.post(`/reservations/${id}/share`)),
  pickupPass: (token: string) => unwrap<PickupPass>(api.get(`/pickup/${token}`)),
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

export const adminApi = {
  stats: () => unwrap<AdminStats>(api.get('/admin/stats')),
  users: (params: { q?: string; role?: Role; limit?: number }) =>
    api.get<ApiList<AdminUser>>('/admin/users', { params }).then((res) => res.data),
  setRole: (id: string, role: Role) => unwrap<AdminUser>(api.patch(`/admin/users/${id}/role`, { role })),
  businesses: (params: { q?: string; status?: 'active' | 'inactive'; limit?: number }) =>
    api.get<ApiList<AdminBusiness>>('/admin/businesses', { params }).then((res) => res.data),
  setBlocked: (id: string, blocked: boolean) => unwrap<AdminUser>(api.patch(`/admin/users/${id}/block`, { blocked })),
  reservations: (params: { status?: ReservationStatus; q?: string; limit?: number }) =>
    api.get<ApiList<Reservation>>('/admin/reservations', { params }).then((res) => res.data),
  reviews: (params: { hidden?: boolean; limit?: number }) => api.get<ApiList<AdminReview>>('/admin/reviews', { params }).then((res) => res.data),
  setReviewHidden: (id: string, hidden: boolean) => unwrap<{ id: string; isHidden: boolean }>(api.patch(`/admin/reviews/${id}`, { hidden })),
  applications: (params: { status?: ApplicationStatus; limit?: number }) =>
    api.get<ApiList<PartnerApplication>>('/admin/applications', { params }).then((res) => res.data),
  decideApplication: (id: string, body: { status: 'approved' | 'rejected'; note?: string }) =>
    unwrap<PartnerApplication>(api.patch(`/admin/applications/${id}`, body)),
  audit: (params: { limit?: number }) => api.get<ApiList<AuditEntry>>('/admin/audit', { params }).then((res) => res.data),
}

export const partnerApi = {
  /** Sales and stock for one local day (YYYY-MM-DD, default today). */
  sales: (params: { date?: string; businessId?: string }) => unwrap<SalesReport>(api.get('/partner/sales', { params })),
  orders: (params: { date?: string; status?: 'active' | 'collected' | 'cancelled' | 'expired' }) =>
    api.get<{ data: Reservation[]; meta: { date: string; total: number } }>('/partner/orders', { params }).then((res) => res.data),
  apply: (body: PartnerApplicationInput) => unwrap<PartnerApplication>(api.post('/partner-applications', body)),
  myApplication: () => unwrap<PartnerApplication | null>(api.get('/partner-applications/me')),
}

export const notificationsApi = {
  list: () => unwrap<{ unread: number; items: AppNotification[] }>(api.get('/notifications')),
  unreadCount: () => unwrap<{ unread: number }>(api.get('/notifications/unread-count')),
  readAll: () => unwrap<{ unread: number }>(api.post('/notifications/read-all')),
}

export const waitlistApi = {
  mine: () => unwrap<string[]>(api.get('/waitlist')),
  join: (offerId: string) => api.put(`/waitlist/${offerId}`).then(() => undefined),
  leave: (offerId: string) => api.delete(`/waitlist/${offerId}`).then(() => undefined),
}
