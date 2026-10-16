/** TanStack Query hooks — the only way screens read or mutate server state. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { uploadsApi, type ImageKind } from '@/api/services'
import { adminApi, authApi, businessesApi, favoritesApi, notificationsApi, offersApi, partnerApi, promotionsApi, reservationsApi, supportApi, waitlistApi } from '@/api/services'
import type { Donation, PromotionInput, TicketCategory, TicketStatus, WebhookEvent, ApplicationStatus, BoundingBox, BusinessInput, PartnerApplicationInput, ReservationStatus, Favorite, FavoriteTarget, OfferFilters, OfferInput, OfferPatch, OfferQuery, Reservation, Role } from '@/api/types'
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
    mutationFn: (input: { id: string } | { code: string; reservationId?: string }) =>
      'id' in input ? reservationsApi.collect(input.id) : reservationsApi.collectByCode(input),
    onSuccess: (reservation) => queryClient.setQueryData(['reservations', 'detail', reservation.id], reservation),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['reservations'] }),
  })
}

export function useCreateReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { offerId: string; quantity: number; promoCode?: string }) => reservationsApi.create(body),
    onSettled: () => {
      // Availability changed for everyone: refresh offers and my reservations.
      queryClient.invalidateQueries({ queryKey: ['offers'] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}

export function useCancelReservation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reservationsApi.cancel,
    onSuccess: (reservation) => queryClient.setQueryData(['reservations', 'detail', reservation.id], reservation),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
      queryClient.invalidateQueries({ queryKey: ['offers'] })
    },
  })
}

/** Create (OfferInput) or update (id + OfferPatch) an offer. */
export function useSaveOffer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; body: OfferPatch } | { id?: undefined; body: OfferInput }) =>
      input.id ? offersApi.update(input.id, input.body) : offersApi.create(input.body as OfferInput),
    onSuccess: (offer) => queryClient.setQueryData(['offers', 'detail', offer.id], offer),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] })
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
    },
  })
}

export function useDeleteBusiness() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: businessesApi.remove,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
      queryClient.invalidateQueries({ queryKey: ['offers'] })
      queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
  })
}

export function useDeleteOffer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: offersApi.remove,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] })
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
    },
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
      queryClient.invalidateQueries({ queryKey: ['offers'] })
    },
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
    mutationFn: (body: { reservationId: string; rating: number; comment?: string }) => businessesApi.addReview(businessId, body),
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

export function useSetCommission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ businessId, rate }: { businessId: string; rate: number | null }) => adminApi.setCommission(businessId, rate),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin', 'statement'] }),
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
