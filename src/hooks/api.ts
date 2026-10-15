/** TanStack Query hooks — the only way screens read or mutate server state. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { businessesApi, favoritesApi, offersApi, reservationsApi } from '@/api/services'
import type { BusinessInput, Favorite, FavoriteTarget, OfferInput, OfferPatch, OfferQuery, Reservation } from '@/api/types'
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
    mutationFn: reservationsApi.create,
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
