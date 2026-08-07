import { useAuthStore } from '../store/authStore'

/**
 * Pushes a single activity event to Odoo. Mirrors the same sync built for
 * the inventory, appointment, and to-do apps (see ACTIVITY_TRACKER_ODOO_SYNC.md
 * and its siblings in those repos) — same idempotency-key pattern, same
 * best-effort fire-and-forget semantics, same X-Snabbb-Api-Key + email auth
 * model.
 *
 * This app is deployed as Cloudflare Pages Functions (file-based routing
 * under functions/, confirmed live via functions/api/login.ts,
 * functions/api/sign-up.ts, functions/api/user/theme.ts — all real, in-use
 * routes), not a single worker.js file or a shared cross-app worker. The
 * matching endpoint lives at functions/api/elearning/activity.ts.
 *
 * This call is best-effort: activity logging must never block the UI or
 * fail the underlying Supabase write (comment, follow, video, application),
 * so callers should fire-and-forget it and swallow/log errors rather than
 * await + throw.
 */

const ACTIVITY_ENDPOINT = '/api/elearning/activity'

export interface ElearningActivityPayload {
  logId: string // idempotency key so retries don't double-log in Odoo
  actorEmail: string | null // used by the function/Odoo to resolve the partner
  actorName: string | null
  supabaseUserId: string | null
  action: string // e.g. "video_uploaded", "comment_posted", "creator_followed", ...
  details: string
  occurredAt: string // ISO timestamp
}

export async function logActivityToOdoo(params: ElearningActivityPayload): Promise<boolean> {
  if (!params.actorEmail) {
    // Nothing to resolve the Odoo partner by — skip rather than send a
    // request we know the backend will reject.
    console.warn('Skipping Odoo activity sync: no actor email available.')
    return false
  }

  const payload = {
    external_ref: `elearning-activity-${params.logId}`,
    actor_email: params.actorEmail,
    actor_name: params.actorName ?? null,
    supabase_user_id: params.supabaseUserId ?? null,
    action: params.action,
    details: params.details,
    occurred_at: params.occurredAt,
  }

  try {
    const res = await fetch(ACTIVITY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json().catch(() => null)
    if (!res.ok || data?.ok === false) {
      console.error('Failed to sync activity to Odoo:', data?.error || res.status)
      return false
    }
    return true
  } catch (err: any) {
    // Best-effort: the function/Odoo being unreachable should never break the local write.
    console.error('Failed to sync activity to Odoo:', err?.message || err)
    return false
  }
}

/**
 * Convenience wrapper: pulls actor identity from the Zustand auth store
 * (src/store/authStore.ts) so query-layer functions (comments.ts,
 * follows.ts, videos.ts, creatorApplications.ts) don't each need to thread
 * user/profile objects through their existing signatures just for this.
 * Safe to call outside React components — Zustand stores support
 * `.getState()` synchronously anywhere, no hook required.
 */
export function logElearningActivity(action: string, details: string): void {
  const { user, profile } = useAuthStore.getState()
  logActivityToOdoo({
    logId: crypto.randomUUID(),
    actorEmail: user?.email ?? null,
    actorName: profile?.full_name ?? null,
    supabaseUserId: user?.id ?? null,
    action,
    details,
    occurredAt: new Date().toISOString(),
  })
}
