// Runtime PII-minimization boundary between the app's existing
// `NotificationWithActor[]` state (from `fetchNotifications` in
// src/lib/queries/notifications.ts — already joined against
// `profiles!notifications_actor_id_fkey` and `videos`) and the AI
// Experience pipeline.
//
// `NotificationWithActor` carries a full-shaped `profiles` object
// (`user_id, name, full_name, username, avatar_url`) and a full-shaped
// `videos` object (`id, title, thumbnail_url`) per row. TypeScript
// structural typing does not strip properties at runtime — passing the
// original notification objects through a narrower TYPE would not
// actually remove those fields from the object references the provider
// receives. This function performs a real runtime projection: it builds
// brand-new plain objects containing only the operational fields this
// slice's provider needs, so the provider is physically incapable of
// reading `avatar_url`, `video.title`, `video.thumbnail_url`, or any
// other joined field, regardless of what the source rows contain.
//
// Creator display name is resolved HERE (via the app's own existing
// `getDisplayName` helper, src/lib/utils.ts) rather than being passed
// through as a raw `profiles` object — so the provider/facts layer never
// sees the actor's profile shape at all, only an already-resolved display
// string (or `undefined` if none could be resolved). `getDisplayName`'s
// own `email` fallback candidate is a structural no-op here: the actor
// profile join never selects `email` in the first place (see
// fetchNotifications), so it can never leak through this path.
//
// Called once, before anything is handed to the provider — see
// ../hooks/useElearningPersonalizedInsight.ts.

import { getDisplayName } from '@/lib/utils';
import type { NotificationWithActor } from '@/types';

/** Minimal shape the Followed Creator Posted provider actually reads —
 *  deliberately not the full `NotificationWithActor` row, which also
 *  carries `recipient_id`, `comment_id`, and full joined `profiles`/
 *  `videos` objects. `recipientId` is intentionally NOT projected: the
 *  source query is already scoped to the current user
 *  (`.eq('recipient_id', userId)`), so ownership is guaranteed before
 *  projection ever runs — carrying it forward would add nothing. */
export interface ProjectedNotification {
  id: string;
  actorId: string;
  videoId: string | null;
  createdAt: string;
  type: NotificationWithActor['type'];
  isRead: boolean;
  /** Already-resolved display string, or `undefined` if no real name
   *  could be resolved from the joined (email-free) actor profile —
   *  never a fabricated placeholder. */
  actorDisplayName?: string;
}

export function projectNotificationsForFollowedCreatorPosted(
  notifications: NotificationWithActor[] | undefined
): ProjectedNotification[] {
  if (!Array.isArray(notifications)) return [];

  return notifications.map((row) => {
    const resolvedName = getDisplayName(row.profiles, '').trim();
    return {
      id: row.id,
      actorId: row.actor_id,
      videoId: row.video_id,
      createdAt: row.created_at,
      type: row.type,
      isRead: row.is_read,
      ...(resolvedName ? { actorDisplayName: resolvedName } : {}),
    };
  });
}
