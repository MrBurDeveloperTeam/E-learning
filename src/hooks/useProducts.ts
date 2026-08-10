import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchCreditSettings,
  fetchMyProductPurchases,
  fetchVideoProducts,
  replaceVideoProducts,
  searchPartnerProducts,
  updateCreditSettings,
  type FeaturedProductInput,
} from '../lib/queries/products'
import { useAuthStore } from '../store/authStore'

export function usePartnerProductSearch(query: string) {
  return useQuery({
    queryKey: ['partner-products', query],
    queryFn: () => searchPartnerProducts(query),
    // Always enabled (even for an empty query) so the picker shows a default
    // list of Snabbb partner products as soon as it opens.
    staleTime: 30_000,
  })
}

export function useVideoProducts(videoId: string) {
  return useQuery({
    queryKey: ['video-products', videoId],
    queryFn: () => fetchVideoProducts(videoId),
    enabled: !!videoId,
  })
}

export function useSaveVideoProducts() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({
      videoId,
      creatorId,
      products,
    }: {
      videoId: string
      creatorId: string
      products: FeaturedProductInput[]
    }) => replaceVideoProducts(videoId, creatorId, products),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['video-products', variables.videoId] })
      qc.invalidateQueries({ queryKey: ['video', variables.videoId] })
    },
  })
}

export function useCreditSettings() {
  return useQuery({
    queryKey: ['snabbb-credit-settings'],
    queryFn: fetchCreditSettings,
  })
}

export function useUpdateCreditSettings() {
  const qc = useQueryClient()
  const profile = useAuthStore((state) => state.profile)

  return useMutation({
    mutationFn: (params: { credit_type: 'flat' | 'percentage'; credit_value: number; is_active: boolean }) =>
      updateCreditSettings({ ...params, updated_by: profile!.user_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['snabbb-credit-settings'] })
    },
  })
}

export function useMyProductPurchases() {
  const profile = useAuthStore((state) => state.profile)

  return useQuery({
    queryKey: ['my-product-purchases', profile?.user_id],
    queryFn: () => fetchMyProductPurchases(profile!.user_id),
    enabled: !!profile?.user_id,
  })
}
