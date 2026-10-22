// src/hooks/useProfileImage.ts
import { useQuery } from "@tanstack/react-query";
import { fetchAccountProfile } from "../lib/accountProfile";

export const PROFILE_IMAGE_QUERY_KEY = ["account-profile-image"] as const;

export function useProfileImage(isLoggedIn: boolean | null) {
  const { data } = useQuery({
    queryKey: PROFILE_IMAGE_QUERY_KEY,
    queryFn: async () => (await fetchAccountProfile()).imageUrl,
    enabled: Boolean(isLoggedIn),
    staleTime: 10 * 60 * 1000, // shared across all components for 10 min
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  return { profileImageUrl: isLoggedIn ? data ?? null : null };
}
