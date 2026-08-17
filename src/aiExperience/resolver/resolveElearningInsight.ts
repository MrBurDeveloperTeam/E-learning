// Minimal deterministic local resolver for this first E-Learning Phase-2B
// slice — mirrors the same small-module structure already browser-
// validated in the To-Do/Inventory/Appointments repos (resolveTodoInsight.ts
// / resolveInventoryInsight.ts / resolveAppointmentInsight.ts), even though
// this first slice only has one candidate. Kept as a real function (not
// inlined into the hook) so a later slice (Video Performance, Most Viewed)
// can extend it additively without restructuring call sites, exactly as
// happened in the other repos.
//
// This is intentionally NOT the Gallery global resolver (resolveDialogue.ts)
// and does not import it — Gallery's global cross-app priority is untouched
// and unrelated to this local, E-Learning-only ranking.

import {
  evaluateFollowedCreatorPosted,
  type FollowedCreatorPostedFacts,
} from '../providers/followedCreatorPostedProvider';
import type { ProjectedNotification } from '../utils/notificationProjection';
import type { InsightCandidate } from '../contracts/insightCandidate';

// Return type is deliberately the single concrete facts type (not widened
// to `InsightCandidate<unknown>`) since this slice has exactly one
// candidate — this lets Home.tsx read `facts.videoId`/`facts.notificationId`
// for its action handler without an unsafe cast. Once a second trigger
// (e.g. Video Performance) is added, this becomes a real discriminated
// union at that point — not invented speculatively now.
export function resolveElearningInsight(
  notifications: ProjectedNotification[],
  followingIds: Set<string>
): InsightCandidate<FollowedCreatorPostedFacts> | null {
  return evaluateFollowedCreatorPosted(notifications, followingIds) ?? null;
}
