// Minimal hook wiring the local resolver into React — mirrors the
// browser-validated To-Do/Inventory/Appointments pattern
// (useTodoPersonalizedInsight.ts / useInventoryPersonalizedInsight.ts /
// useAppointmentPersonalizedInsight.ts).
//
// REUSED, NOT DUPLICATED STATE:
//
// 1. Notifications: this hook uses the EXACT SAME React Query key and
// query function as `useNotifications()` (src/hooks/useNotifications.ts) —
// `['notifications', profile?.user_id]` / `fetchNotifications`. Home.tsx
// already renders `<Navbar />`, which mounts `NotificationBell`, which
// already calls `useNotifications()` — meaning this exact cache entry is
// already being fetched and kept live (realtime INSERT invalidation +
// mark-read invalidation, both already wired in useNotifications.ts/
// useMarkRead) whenever this hook is used on Home. Calling `useQuery` here
// with the identical key/queryFn shares that cache (React Query dedupes by
// key) rather than issuing a second network request, and requires no new
// Supabase realtime channel of its own. Bounded to the same 30 most-recent
// notifications `fetchNotifications` already fetches — the app's own
// existing convention, not a new arbitrary constant.
//
// 2. Following: this hook calls `useFollowing(profile?.user_id ?? '')` —
// the exact same hook (and query key `['following', userId]`) Home.tsx
// itself already calls to build its own `followingIds` set for creator
// suggestions. Same cache-sharing rationale — this is not a second follows
// query.
//
// FAIL-CLOSED ON PARTIAL STATE: current-follow status is required by the
// product rule (see ../providers/followedCreatorPostedProvider.ts's file
// header). While either the notifications query or the following query is
// still loading, or if either has errored, the current follow relationship
// (and therefore trigger eligibility) is UNKNOWN — not "no follows" and not
// "not currently followed". This hook returns `null` in all of those
// states rather than guessing, exactly like an uncovered date range in the
// Appointments repo means "unknown", never "zero".
//
// NO NEW TIMER, NO SESSION DEDUPE: eligibility is driven entirely by
// `notifications.is_read` (persistent, database-backed) and the current
// `followingIds` set — both already reactive to their own underlying
// query/cache updates. There is no time-window rule here (unlike
// Appointments' 2-hour clock), so no minute-boundary or interval mechanism
// is needed or added.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useFollowing } from '@/hooks/useFollow';
import { fetchNotifications } from '@/lib/queries/notifications';
import { resolveElearningInsight } from '../resolver/resolveElearningInsight';
import { projectNotificationsForFollowedCreatorPosted } from '../utils/notificationProjection';
import type { FollowedCreatorPostedFacts } from '../providers/followedCreatorPostedProvider';
import type { InsightCandidate } from '../contracts/insightCandidate';

export function useElearningPersonalizedInsight(): InsightCandidate<FollowedCreatorPostedFacts> | null {
  const profile = useAuthStore((state) => state.profile);
  const userId = profile?.user_id;

  const notificationsQuery = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => fetchNotifications(userId!),
    enabled: !!userId,
  });

  const followingQuery = useFollowing(userId ?? '');

  return useMemo(() => {
    if (!userId) return null;
    if (notificationsQuery.isLoading || notificationsQuery.isError) return null;
    if (followingQuery.isLoading || followingQuery.isError) return null;

    try {
      const projected = projectNotificationsForFollowedCreatorPosted(notificationsQuery.data);
      const followingIds = new Set(
        (followingQuery.data ?? [])
          .map((row) => row.following_id)
          .filter((value): value is string => !!value)
      );
      return resolveElearningInsight(projected, followingIds);
    } catch (err) {
      // A provider failure must never produce a fabricated personalized
      // claim or a raw error surfaced to the user. Evaluation here is pure
      // (no network call) — this is only a last-resort guard against a
      // malformed notification row; the safe behavior is simply "no
      // insight this render". Never logs the notification/profile objects.
      console.warn('[aiExperience] elearning personalized insight evaluation failed:', err);
      return null;
    }
  }, [
    userId,
    notificationsQuery.isLoading,
    notificationsQuery.isError,
    notificationsQuery.data,
    followingQuery.isLoading,
    followingQuery.isError,
    followingQuery.data,
  ]);
}
