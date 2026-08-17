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
// NO NEW TIMER, NO SESSION DEDUPE (Followed Creator Posted): eligibility
// is driven entirely by `notifications.is_read` (persistent,
// database-backed) and the current `followingIds` set — both already
// reactive to their own underlying query/cache updates. There is no
// time-window rule here (unlike Appointments' 2-hour clock), so no
// minute-boundary or interval mechanism is needed or added.
//
// SLICE 2 — OWN-VIDEO ANALYTICS: `fetchOwnVideoAnalyticsSnapshot`
// (src/lib/queries/videos.ts) is a genuinely NEW, narrow, ownership-scoped
// query pair (`creator_id = currentUser`, `id/view_count/created_at` only)
// — there is no existing already-loaded state on Home this could reuse
// instead. Query key `['own-video-analytics', userId]` is explicit and
// user-scoped (never shared across users), `enabled` only once `userId` is
// known, and deliberately uses this app's normal global QueryClient
// defaults (`staleTime: 5min`, `refetchOnWindowFocus: false` — see
// src/lib/queryClient.ts) rather than a bespoke local override: no
// polling, no new realtime channel, current-state reflection only.
//
// PRIORITY MUST NOT WAIT ON A LOWER-PRIORITY QUERY: Followed Creator
// Posted (social, higher priority) and the own-video analytics candidates
// (lower priority) come from entirely independent data sources. This hook
// deliberately does NOT gate on `ownVideoAnalyticsQuery` before calling
// the resolver — doing so would let a slow/failed analytics request hide
// an already-known, ready Followed Creator Posted candidate, which is
// backwards from the intended priority. Instead, `ownVideoAnalyticsQuery`
// loading/error is passed into the resolver as `undefined` ("analytics
// state unknown"), and `resolveElearningInsight` itself only consults that
// value AFTER confirming Followed Creator Posted is absent — see that
// file's header for the full readiness contract. `undefined` here is
// never conflated with "ready, but no qualifying video" (`null`/an empty
// snapshot) — unknown analytics never gets fabricated into "0 views"/"no
// videos" once social is confirmed absent and analytics actually is
// checked.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useFollowing } from '@/hooks/useFollow';
import { fetchNotifications } from '@/lib/queries/notifications';
import { fetchOwnVideoAnalyticsSnapshot } from '@/lib/queries/videos';
import { resolveElearningInsight, type ElearningInsightCandidate } from '../resolver/resolveElearningInsight';
import { projectNotificationsForFollowedCreatorPosted } from '../utils/notificationProjection';

export function useElearningPersonalizedInsight(): ElearningInsightCandidate | null {
  const profile = useAuthStore((state) => state.profile);
  const userId = profile?.user_id;

  const notificationsQuery = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => fetchNotifications(userId!),
    enabled: !!userId,
  });

  const followingQuery = useFollowing(userId ?? '');

  const ownVideoAnalyticsQuery = useQuery({
    queryKey: ['own-video-analytics', userId],
    queryFn: () => fetchOwnVideoAnalyticsSnapshot(userId!),
    enabled: !!userId,
  });

  return useMemo(() => {
    // Auth/social sources unknown: the highest-priority candidate
    // (Followed Creator Posted) itself cannot be evaluated yet — never
    // surface a lower-priority analytics claim through an unknown higher
    // tier.
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
      // Analytics readiness is intentionally NOT checked here — see the
      // file header. `undefined` is passed through when unknown; the
      // resolver decides whether that matters (only if Followed Creator
      // Posted is absent).
      const ownVideoAnalytics =
        ownVideoAnalyticsQuery.isLoading || ownVideoAnalyticsQuery.isError
          ? undefined
          : ownVideoAnalyticsQuery.data;
      return resolveElearningInsight(projected, followingIds, ownVideoAnalytics);
    } catch (err) {
      // A provider failure must never produce a fabricated personalized
      // claim or a raw error surfaced to the user. Evaluation here is pure
      // (no network call) — this is only a last-resort guard against a
      // malformed notification/video row; the safe behavior is simply "no
      // insight this render". Never logs the notification/profile/video
      // objects.
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
    ownVideoAnalyticsQuery.isLoading,
    ownVideoAnalyticsQuery.isError,
    ownVideoAnalyticsQuery.data,
  ]);
}
