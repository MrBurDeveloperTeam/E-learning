// src/hooks/useProfileImage.ts
import { useQuery } from "@tanstack/react-query";
import { accountProfileKey, fetchAccountProfile } from "../lib/accountProfile";
import { useAuthStore } from "../store/authStore";

// Shares the ['snabbb-account-profile', userId] cache entry with Navbar, Settings,
// Channel and useOwnAccountAvatar, so the whole app makes ONE profile request.
export function useProfileImage(isLoggedIn: boolean | null) {
  const userId = useAuthStore((state) => state.user?.id);

  const { data } = useQuery({
    queryKey: accountProfileKey(userId),
    queryFn: fetchAccountProfile,
    enabled: Boolean(isLoggedIn && userId),
    staleTime: 60_000,
    retry: false,
    select: (profile) => profile.imageUrl,
  });

  return { profileImageUrl: isLoggedIn ? data ?? null : null };
}
