/** TanStack Query hooks — the only way screens read or mutate server state. */
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { uploadsApi, type CreateReservationBody, type ImageKind } from '@/api/services'
import { adminApi, authApi, businessesApi, favoritesApi, notificationsApi, offersApi, partnerApi, promotionsApi, reservationsApi, schedulesApi, supportApi, waitlistApi } from '@/api/services'
import type { BoostKind, DeliveryMessageKey, OfferScheduleInput, Donation, PromotionInput, TicketCategory, TicketStatus, WebhookEvent, ApplicationStatus, BoundingBox, BusinessInput, PartnerApplicationInput, ReservationStatus, Favorite, FavoriteTarget, OfferFilters, OfferInput, OfferPatch, OfferQuery, Reservation, Role } from '@/api/types'
import { useAuth } from '@/features/auth/auth-context'

export function useOffers(query: OfferQuery, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['offers', 'list', query],
    queryFn: () => offersApi.list(query),
    placeholderData: keepPreviousData,
    ...options,
  })
}

export function useOffer(id: string | undefined) {
  return useQuery({ queryKey: ['offers', 'detail', id], queryFn: () => offersApi.get(id!), enabled: !!id })
}

export function useBusinessReviews(businessId: string | undefined) {
  return useQuery({
    queryKey: ['businesses', businessId, 'reviews'],
    queryFn: () => businessesApi.reviews(businessId!),
    enabled: !!businessId,
  })
}

export function useMyBusinesses() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['businesses', 'mine', user?.id], queryFn: () => businessesApi.list({ owner: 'me' }), enabled: !!user })
}

// ---------------------------------------------------------------------------
// Cache refresh after changes. A reservation or offer change is visible in many
// screens at once (customer lists, the partner's orders, sales, stock and
// statement, offers, admin panel), so every mutation refreshes all of them.

const RESERVATION_VIEWS = [
  ['reservations'],
  ['offers'],
  ['businesses'],
  ['partner', 'orders'],
  ['partner', 'sales'],
  ['partner', 'statement'],
  ['partner', 'outstanding'],
  ['admin', 'stats'],
  ['admin', 'reservations'],
  ['admin', 'statement'],
  ['admin', 'outstanding'],
]
const CATALOG_VIEWS = [['offers'], ['businesses'], ['partner', 'orders'], ['partner', 'sales'], ['partner', 'suggestion'], ['admin', 'businesses'], ['admin', 'stats']]

const refresh = (queryClient: QueryClient, keys: string[][]) => Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))

/** Show the new status in every cached list right away, before the refetch lands. */
function patchReservation(queryClient: QueryClient, reservation: Reservation) {
  queryClient.setQueryData(['reservations', 'detail', reservation.id], reservation)
  const replace = (old: unknown) => {
    const list = old as { data?: Reservation[] } | undefined
    if (!list || !Array.isArray(list.data)) return old
    return { ...list, data: list.data.map((r) => (r.id === reservation.id ? { ...r, ...reservation } : r)) }
  }
  queryClient.setQueriesData({ queryKey: ['partner', 'orders'] }, replace)
  queryClient.setQueriesData({ queryKey: ['reservations'] }, replace)
  queryClient.setQueriesData({ queryKey: ['admin', 'reservations'] }, replace)
}

export function useReservations(scope: 'upcoming' | 'history') {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['reservations', 'list', scope],
    queryFn: () => reservationsApi.list({ scope }),
    enabled: !!user,
  })
}

const isActiveReservation = (r?: Reservation) => r?.status === 'confirmed' || r?.status === 'pending_payment'

/**
 * While a reservation is still active the page polls, so the customer sees
 * "Preuzeto" a few seconds after the shop scans the code.
 */
export function useReservation(id: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['reservations', 'detail', id],
    queryFn: () => reservationsApi.get(id!),
    enabled: !!user && !!id,
    refetchInterval: (query) => (isActiveReservation(query.state.data) ? 5_000 : false),
  })
}

/** Business staff: active reservations for one of their locations. */
export function useBusinessReservations(businessId: string) {
  return useQuery({
    queryKey: ['reservations', 'business', businessId],
    queryFn: () => reservationsApi.list({ businessId, scope: 'upcoming', limit: 100 }),
    refetchInterval: 30_000,
  })
}

export function useCollectReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string } | { code: string; reservationId?: string; via?: 'qr' | 'code' }) =>
      'id' in input ? reservationsApi.collect(input.id) : reservationsApi.collectByCode(input),
    onSuccess: (reservation) => patchReservation(queryClient, reservation),
    onSettled: () => refresh(queryClient, RESERVATION_VIEWS),
  })
}

/** Staff: start a delivery (this person becomes the courier). */
export function useStartDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reservationsApi.startDelivery,
    onSuccess: (reservation) => patchReservation(queryClient, reservation),
    onSettled: () => refresh(queryClient, [['partner', 'orders']]),
  })
}

/** Customer answers "did you pick it up?" (yes turns it into a pickup). */
export function usePickupCheck() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; answer: 'collected' | 'not_collected' }) => reservationsApi.pickupCheck(v.id, v.answer),
    onSuccess: (reservation) => patchReservation(queryClient, reservation),
    onSettled: () => refresh(queryClient, [['reservations'], ['auth', 'me']]),
  })
}

export function usePartnerIntegrity(days = 30) {
  return useQuery({ queryKey: ['partner', 'integrity', days], queryFn: () => partnerApi.integrity(days) })
}

export function useDisputePickup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) => reservationsApi.dispute(v.id, v.reason),
    onSettled: () => refresh(queryClient, [['partner', 'integrity'], ['partner', 'orders']]),
  })
}

export function useTeam() {
  return useQuery({ queryKey: ['partner', 'team'], queryFn: partnerApi.team })
}

/** Add (email) or change locations (userId) of a staff member. */
export function useSaveTeamMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: { email?: string; userId?: string; businessIds: string[] }) =>
      v.userId ? partnerApi.updateTeamMember(v.userId, v.businessIds) : partnerApi.addTeamMember({ email: v.email!, businessIds: v.businessIds }),
    onSettled: () => refresh(queryClient, [['partner', 'team'], ['businesses']]),
  })
}

export function useStaffAccess(userId: string | null) {
  return useQuery({ queryKey: ['admin', 'staff-access', userId], queryFn: () => adminApi.staffAccess(userId!), enabled: !!userId })
}

export function useSetStaffAccess() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: { userId: string; businessIds: string[] }) => adminApi.setStaffAccess(v.userId, v.businessIds),
    onSettled: () => refresh(queryClient, [['admin']]),
  })
}

export function usePlatformIntegrity(days = 30) {
  return useQuery({ queryKey: ['admin', 'integrity', days], queryFn: () => adminApi.integrity(days) })
}

export function useDisputes(enabled = true) {
  return useQuery({ queryKey: ['admin', 'disputes'], queryFn: adminApi.disputes, enabled })
}

export function useResolveDispute() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; decision: 'upheld' | 'rejected'; note?: string }) => adminApi.resolveDispute(v.id, v),
    onSettled: () => refresh(queryClient, [['admin', 'disputes'], ['admin', 'integrity'], ['admin', 'statement']]),
  })
}

/** Scanner: check a code (no side effects, nothing to refresh). */
export function useVerifyCode() {
  return useMutation({ mutationFn: reservationsApi.verify })
}

export function useCreateReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateReservationBody) => reservationsApi.create(body),
    // Availability changed for everyone: refresh offers, reservations and stock.
    onSettled: () => refresh(queryClient, RESERVATION_VIEWS),
  })
}

export function useCancelReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reservationsApi.cancel,
    onSuccess: (reservation) => patchReservation(queryClient, reservation),
    onSettled: () => refresh(queryClient, RESERVATION_VIEWS),
  })
}

export function useFavorites() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['favorites'], queryFn: favoritesApi.list, enabled: !!user, staleTime: 60_000 })
}

/** Returns the favorite record for a target (if any) plus an optimistic toggle. */
export function useFavoriteToggle(targetType: FavoriteTarget, targetId: string) {
  const queryClient = useQueryClient()
  const { data } = useFavorites()
  const favorite = data?.data.find((f) => f.targetType === targetType && f.targetId === targetId)

  const mutation = useMutation({
    mutationFn: async (current: Favorite | undefined) => {
      if (current) await favoritesApi.remove(current.id)
      else await favoritesApi.add({ targetType, targetId })
    },
    onMutate: async (current) => {
      await queryClient.cancelQueries({ queryKey: ['favorites'] })
      const previous = queryClient.getQueryData<{ data: Favorite[] }>(['favorites'])
      if (previous) {
        const next = current
          ? previous.data.filter((f) => f.id !== current.id)
          : [...previous.data, { id: `tmp-${targetId}`, targetType, targetId, createdAt: new Date().toISOString() }]
        queryClient.setQueryData(['favorites'], { ...previous, data: next })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['favorites'], context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  })

  return { isFavorite: !!favorite, toggle: () => mutation.mutate(favorite), isPending: mutation.isPending }
}

export function useBusiness(id: string | undefined) {
  return useQuery({ queryKey: ['businesses', 'detail', id], queryFn: () => businessesApi.get(id!), enabled: !!id, staleTime: 300_000 })
}

// ---------------------------------------------------------------------------
// Partner portal

export function useBusinessOffers(businessId: string | undefined) {
  return useQuery({
    queryKey: ['businesses', businessId, 'offers'],
    queryFn: () => businessesApi.offers(businessId!),
    enabled: !!businessId,
  })
}

/** Create (no id) or update a location. */
export function useSaveBusiness() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: BusinessInput }) => (id ? businessesApi.update(id, body) : businessesApi.create(body)),
    onSuccess: (business) => queryClient.setQueryData(['businesses', 'detail', business.id], business),
    onSettled: () => refresh(queryClient, [...CATALOG_VIEWS, ['partner', 'workplaces']]),
  })
}

/** Create (OfferInput) or update (id + OfferPatch) an offer. */
export function useSaveOffer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; body: OfferPatch } | { id?: undefined; body: OfferInput }) =>
      input.id ? offersApi.update(input.id, input.body) : offersApi.create(input.body as OfferInput),
    onSuccess: (offer) => queryClient.setQueryData(['offers', 'detail', offer.id], offer),
    onSettled: () => refresh(queryClient, CATALOG_VIEWS),
  })
}

export function useDeleteBusiness() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: businessesApi.remove,
    onSettled: () => refresh(queryClient, [...CATALOG_VIEWS, ['partner', 'workplaces'], ['admin']]),
  })
}

export function useDeleteOffer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: offersApi.remove,
    onSettled: () => refresh(queryClient, CATALOG_VIEWS),
  })
}

// ---------------------------------------------------------------------------
// Admin panel

export function useAdminStats() {
  return useQuery({ queryKey: ['admin', 'stats'], queryFn: adminApi.stats })
}

export function useAdminUsers(params: { q?: string; role?: Role; limit?: number }) {
  return useQuery({ queryKey: ['admin', 'users', params], queryFn: () => adminApi.users(params), placeholderData: keepPreviousData })
}

export function useSetUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => adminApi.setRole(id, role),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  })
}

export function useAdminBusinesses(params: { q?: string; status?: 'active' | 'inactive'; limit?: number }) {
  return useQuery({ queryKey: ['admin', 'businesses', params], queryFn: () => adminApi.businesses(params), placeholderData: keepPreviousData })
}

/** Admin moderation: switch a location on/off (deactivating also pauses its offers). */
export function useSetBusinessActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => businessesApi.update(id, { isActive }),
    onSettled: () => refresh(queryClient, [...CATALOG_VIEWS, ['admin']]),
  })
}

export function useOfferLocations(params: (OfferFilters & BoundingBox) | null) {
  return useQuery({
    queryKey: ['offers', 'locations', params],
    queryFn: () => offersApi.locations(params!),
    enabled: !!params,
    placeholderData: keepPreviousData,
  })
}

/** Partner sales/stock for one day; refreshes every 30 s while open. */
export function usePartnerSales(date?: string) {
  return useQuery({
    queryKey: ['partner', 'sales', date ?? 'today'],
    queryFn: () => partnerApi.sales({ date }),
    refetchInterval: 30_000,
  })
}

// ---------------------------------------------------------------------------
// Notifications, waitlist, sharing, applications, moderation

/** Unread badge: light polling (60 s) + refresh on focus. */
export function useUnreadCount() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['notifications', 'unread'], queryFn: notificationsApi.unreadCount, enabled: !!user, refetchInterval: 60_000 })
}

export function useNotifications(enabled: boolean) {
  return useQuery({ queryKey: ['notifications', 'list'], queryFn: notificationsApi.list, enabled })
}

export function useReadAllNotifications() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.readAll,
    onSuccess: () => queryClient.setQueryData(['notifications', 'unread'], { unread: 0 }),
  })
}

export function useWaitlist() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['waitlist'], queryFn: waitlistApi.mine, enabled: !!user })
}

export function useToggleWaitlist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ offerId, join }: { offerId: string; join: boolean }) => (join ? waitlistApi.join(offerId) : waitlistApi.leave(offerId)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['waitlist'] }),
  })
}

export function useShareReservation() {
  return useMutation({ mutationFn: reservationsApi.share })
}

export function usePickupPass(token: string | undefined) {
  return useQuery({ queryKey: ['pickup', token], queryFn: () => reservationsApi.pickupPass(token!), enabled: !!token, refetchInterval: 10_000, retry: false })
}

export function useAddReview(businessId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { reservationId: string; rating: number; comment?: string; photos?: string[] }) => businessesApi.addReview(businessId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
    },
  })
}

export function useNewPartners() {
  return useQuery({ queryKey: ['businesses', 'new'], queryFn: () => businessesApi.list({ sort: 'new', limit: 10 }), staleTime: 300_000 })
}

export function useMyApplication() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['application', 'mine', user?.id], queryFn: partnerApi.myApplication, enabled: !!user })
}

export function useApplyAsPartner() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: PartnerApplicationInput) => partnerApi.apply(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['application'] }),
  })
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: authApi.deleteAccount })
}

export function usePartnerOrders(date: string | undefined, status?: 'active' | 'collected' | 'cancelled' | 'expired') {
  return useQuery({ queryKey: ['partner', 'orders', date ?? 'today', status], queryFn: () => partnerApi.orders({ date, status }), refetchInterval: 30_000 })
}

export function useAdminReservations(params: { status?: ReservationStatus; q?: string; limit?: number }) {
  return useQuery({ queryKey: ['admin', 'reservations', params], queryFn: () => adminApi.reservations(params), placeholderData: keepPreviousData })
}

export function useAdminReviews(params: { hidden?: boolean; limit?: number }) {
  return useQuery({ queryKey: ['admin', 'reviews', params], queryFn: () => adminApi.reviews(params), placeholderData: keepPreviousData })
}

export function useSetReviewHidden() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) => adminApi.setReviewHidden(id, hidden),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  })
}

export function useAdminApplications(status?: ApplicationStatus) {
  return useQuery({ queryKey: ['admin', 'applications', status], queryFn: () => adminApi.applications({ status, limit: 100 }) })
}

export function useDecideApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: 'approved' | 'rejected'; note?: string }) => adminApi.decideApplication(id, { status, note }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  })
}

export function useSetUserBlocked() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) => adminApi.setBlocked(id, blocked),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  })
}

export function useAuditLog() {
  return useQuery({ queryKey: ['admin', 'audit'], queryFn: () => adminApi.audit({ limit: 100 }) })
}

// ---------------------------------------------------------------------------
// Staff, preferences, support, promotions, donations, finance, integrations

export function useStaff(businessId: string, enabled = true) {
  return useQuery({ queryKey: ['businesses', businessId, 'staff'], queryFn: () => businessesApi.staff(businessId), enabled })
}

export function useAddStaff(businessId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => businessesApi.addStaff(businessId, email),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['businesses', businessId, 'staff'] }),
  })
}

export function useRemoveStaff(businessId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => businessesApi.removeStaff(businessId, userId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['businesses', businessId, 'staff'] }),
  })
}

export function useWorkplaces(enabled: boolean) {
  return useQuery({ queryKey: ['partner', 'workplaces'], queryFn: partnerApi.workplaces, enabled })
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: authApi.updatePreferences,
    onSuccess: (user) => queryClient.setQueryData(['auth', 'me'], (prev: object | undefined) => ({ ...prev, ...user })),
  })
}

export function useMyTickets() {
  return useQuery({ queryKey: ['support', 'mine'], queryFn: supportApi.mine })
}

export function useTicket(id: string | undefined) {
  return useQuery({ queryKey: ['support', 'ticket', id], queryFn: () => supportApi.get(id!), enabled: !!id, refetchInterval: 30_000 })
}

export function useCreateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { subject: string; category: TicketCategory; message: string; reservationId?: string }) => supportApi.create(body),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['support'] }),
  })
}

export function useReplyTicket(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => supportApi.reply(id, body),
    onSuccess: (ticket) => queryClient.setQueryData(['support', 'ticket', id], ticket),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['support', 'mine'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'support'] })
    },
  })
}

export function useCloseTicket(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => supportApi.close(id),
    onSuccess: (ticket) => queryClient.setQueryData(['support', 'ticket', id], ticket),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['support'] }),
  })
}

export function useAdminTickets(status?: TicketStatus) {
  return useQuery({ queryKey: ['admin', 'support', status], queryFn: () => adminApi.support({ status }) })
}

export function usePromotions(scope: 'mine' | 'platform' | 'all' = 'mine') {
  return useQuery({ queryKey: ['promotions', scope], queryFn: () => promotionsApi.list(scope) })
}

export function useCreatePromotion() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: (body: PromotionInput) => promotionsApi.create(body), onSettled: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }) })
}

export function useTogglePromotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => promotionsApi.update(id, { isActive }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['promotions'] }),
  })
}

export function useCheckPromotion() {
  return useMutation({ mutationFn: promotionsApi.check })
}

export function useDonations(admin = false) {
  return useQuery({ queryKey: ['donations', admin ? 'admin' : 'mine'], queryFn: admin ? adminApi.donations : partnerApi.donations })
}

export function useAddDonation() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: (body: Omit<Donation, 'id' | 'businessName'>) => partnerApi.addDonation(body), onSettled: () => queryClient.invalidateQueries({ queryKey: ['donations'] }) })
}

export function useDeleteDonation() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: partnerApi.deleteDonation, onSettled: () => queryClient.invalidateQueries({ queryKey: ['donations'] }) })
}

export function useSuggestion(businessId: string | undefined, date: string | undefined) {
  return useQuery({
    queryKey: ['partner', 'suggestion', businessId, date],
    queryFn: () => partnerApi.suggestion(businessId!, date!),
    enabled: !!businessId && !!date,
    staleTime: 600_000,
  })
}

export function usePartnerStatement(month: string) {
  return useQuery({ queryKey: ['partner', 'statement', month], queryFn: () => partnerApi.statement(month) })
}

export function usePlatformStatement(month: string) {
  return useQuery({ queryKey: ['admin', 'statement', month], queryFn: () => adminApi.statement(month) })
}

export function useOutstanding(admin: boolean) {
  return useQuery({ queryKey: [admin ? 'admin' : 'partner', 'outstanding'], queryFn: admin ? adminApi.outstanding : partnerApi.outstanding })
}

/** Record / undo a payment; refreshes the month statement and the open balances. */
export function useRecordPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminApi.recordPayment,
    onSettled: () => Promise.all([queryClient.invalidateQueries({ queryKey: ['admin', 'statement'] }), queryClient.invalidateQueries({ queryKey: ['admin', 'outstanding'] })]),
  })
}

export function useDeletePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminApi.deletePayment,
    onSettled: () => Promise.all([queryClient.invalidateQueries({ queryKey: ['admin', 'statement'] }), queryClient.invalidateQueries({ queryKey: ['admin', 'outstanding'] })]),
  })
}

/** The signed-in partner's status and warnings from the platform team. */
export function useMyStanding(enabled: boolean) {
  return useQuery({ queryKey: ['partner', 'standing'], queryFn: partnerApi.standing, enabled, staleTime: 60_000 })
}

export function usePartnerStanding(id: string | null) {
  return useQuery({ queryKey: ['admin', 'standing', id], queryFn: () => adminApi.partnerStanding(id!), enabled: !!id })
}

/** Pause / block / reactivate / warn / resolve / delete; everything admin-side refreshes. */
export function usePartnerModeration() {
  const queryClient = useQueryClient()
  const onSettled = () => queryClient.invalidateQueries({ queryKey: ['admin'] })
  return {
    setStatus: useMutation({ mutationFn: (v: { id: string; status: 'active' | 'paused' | 'blocked'; reason?: string }) => adminApi.setPartnerStatus(v.id, v), onSettled }),
    warn: useMutation({ mutationFn: (v: { id: string; message: string }) => adminApi.warnPartner(v.id, v.message), onSettled }),
    resolve: useMutation({ mutationFn: adminApi.resolveWarning, onSettled }),
    remove: useMutation({ mutationFn: (v: { id: string; reason: string }) => adminApi.deletePartner(v.id, v.reason), onSettled }),
  }
}

export function useSetCommission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ businessId, rate }: { businessId: string; rate: number | null }) => adminApi.setCommission(businessId, rate),
    onSettled: () => refresh(queryClient, [['admin', 'statement'], ['admin', 'outstanding'], ['partner', 'statement']]),
  })
}

export function useApiKeys() {
  return useQuery({ queryKey: ['partner', 'api-keys'], queryFn: partnerApi.apiKeys })
}

export function useCreateApiKey() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: partnerApi.createApiKey, onSettled: () => queryClient.invalidateQueries({ queryKey: ['partner', 'api-keys'] }) })
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: partnerApi.revokeApiKey, onSettled: () => queryClient.invalidateQueries({ queryKey: ['partner', 'api-keys'] }) })
}

export function useWebhooks() {
  return useQuery({ queryKey: ['partner', 'webhooks'], queryFn: partnerApi.webhooks })
}

export function useCreateWebhook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { url: string; events?: WebhookEvent[] }) => partnerApi.createWebhook(body),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['partner', 'webhooks'] }),
  })
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: partnerApi.deleteWebhook, onSettled: () => queryClient.invalidateQueries({ queryKey: ['partner', 'webhooks'] }) })
}

export function useTestWebhook() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: partnerApi.testWebhook, onSettled: () => queryClient.invalidateQueries({ queryKey: ['partner', 'webhooks'] }) })
}

export function useUploadImage(kind: ImageKind) {
  return useMutation({ mutationFn: (file: File) => uploadsApi.image(file, kind) })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (user) => queryClient.setQueryData(['auth', 'me'], user),
  })
}

// ---------------------------------------------------------------------------
// Growth: impact & challenges, repeating offers, paid promotion, photos, delivery chat.

export function useImpact(year?: number) {
  const { user } = useAuth()
  return useQuery({ queryKey: ['impact', year ?? 'current'], queryFn: () => authApi.impact(year), enabled: !!user })
}

export function useSchedules() {
  return useQuery({ queryKey: ['schedules'], queryFn: schedulesApi.list })
}

export function useSaveSchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Partial<OfferScheduleInput> & { isActive?: boolean } }) =>
      id ? schedulesApi.update(id, body) : schedulesApi.create(body as OfferScheduleInput),
    // A new/changed schedule may publish offers right away.
    onSettled: () => refresh(queryClient, [['schedules'], ['businesses'], ['offers']]),
  })
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: schedulesApi.remove, onSettled: () => refresh(queryClient, [['schedules']]) })
}

export function useBagSuggestion(businessId: string | undefined) {
  return useQuery({ queryKey: ['schedules', 'suggestion', businessId], queryFn: () => schedulesApi.suggestion(businessId!), enabled: !!businessId, staleTime: 10 * 60_000 })
}

export function useBoostOptions(offerId: string | undefined) {
  return useQuery({ queryKey: ['boost', offerId], queryFn: () => offersApi.boostOptions(offerId!), enabled: !!offerId })
}

export function useBuyBoost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ offerId, kind }: { offerId: string; kind: BoostKind }) => offersApi.boost(offerId, kind),
    onSettled: (_r, _e, v) => refresh(queryClient, [['boost', v.offerId], ['businesses'], ['offers'], ['partner', 'statement']]),
  })
}

export function useBusinessPhotos(businessId: string | undefined) {
  return useQuery({ queryKey: ['businesses', businessId, 'photos'], queryFn: () => businessesApi.photos(businessId!), enabled: !!businessId, staleTime: 5 * 60_000 })
}

export function useCourierArrived() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: reservationsApi.courierArrived, onSuccess: (r) => patchReservation(queryClient, r) })
}

export function useDeliveryMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, key }: { id: string; key: DeliveryMessageKey }) => reservationsApi.deliveryMessage(id, key),
    onSuccess: (r) => patchReservation(queryClient, r),
  })
}

export function useIntegrityAlerts() {
  return useQuery({ queryKey: ['admin', 'integrity', 'alerts'], queryFn: adminApi.integrityAlerts })
}
