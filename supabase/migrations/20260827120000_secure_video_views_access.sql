-- Security fix for public.video_views / public.record_video_view.
--
-- Two live-audited defects (VIDEO-VIEWS-1 audit phase):
--
-- A. record_video_view(p_user_id, p_video_id) is SECURITY DEFINER and never
--    verified that the calling session's auth.uid() actually matches
--    p_user_id — combined with EXECUTE being granted to PUBLIC (which anon
--    inherits), any unauthenticated caller could record a view "as" an
--    arbitrary real user, bypassing the table's own correct
--    `WITH CHECK (user_id = auth.uid())` INSERT policy entirely (SECURITY
--    DEFINER functions run with the function owner's privileges, not the
--    caller's, for their internal statements).
--
-- B. The "Anyone can view view counts" SELECT policy used `USING (true)`,
--    exposing every raw (user_id, video_id, viewed_at) row publicly. The
--    app only ever needs the aggregate `videos.view_count` (already
--    maintained separately by the existing trigger) — it never reads
--    individual video_views rows for anyone but the current user's own
--    history, which the separate "Users can view own watch history" policy
--    already covers.
--
-- Fix, minimal and additive only:
--   1. Re-create record_video_view with an auth.uid() = p_user_id guard,
--      identical logic otherwise (same null check, same 24h dedupe, same
--      insert, same boolean return, same SECURITY DEFINER + fixed
--      search_path).
--   2. Revoke EXECUTE from PUBLIC and anon; grant it to authenticated only.
--   3. Drop the broad public SELECT policy. The owner-scoped SELECT policy
--      and the table itself are left otherwise untouched.

create or replace function public.record_video_view(p_user_id uuid, p_video_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_row boolean := false;
begin
  if p_user_id is null or p_video_id is null then
    return false;
  end if;

  -- Identity guard: the caller may only ever record a view as themselves.
  -- auth.uid() is null for anonymous/unauthenticated sessions, which also
  -- fails this check (never equals a non-null p_user_id).
  if auth.uid() is distinct from p_user_id then
    return false;
  end if;

  if exists (
    select 1
    from public.video_views
    where user_id = p_user_id
      and video_id = p_video_id
      and viewed_at >= now() - interval '24 hours'
  ) then
    return false;
  end if;

  insert into public.video_views (user_id, video_id)
  values (p_user_id, p_video_id);

  inserted_row := true;
  return inserted_row;
end;
$$;

revoke execute on function public.record_video_view(uuid, uuid) from public;
revoke execute on function public.record_video_view(uuid, uuid) from anon;
grant execute on function public.record_video_view(uuid, uuid) to authenticated;

drop policy if exists "Anyone can view view counts" on public.video_views;
