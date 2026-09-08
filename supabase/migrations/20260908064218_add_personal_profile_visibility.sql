begin;

alter table public.community_user_settings
  add column if not exists profile_visibility text not null default 'public';

update public.community_user_settings
set profile_visibility = 'public'
where profile_visibility not in ('public', 'private');

alter table public.community_user_settings
  drop constraint if exists community_user_settings_profile_visibility_check;
alter table public.community_user_settings
  add constraint community_user_settings_profile_visibility_check
  check (profile_visibility in ('public', 'private'));

drop function if exists public.community_get_profile_access(uuid);
create function public.community_get_profile_access(target_user_id uuid)
returns table (
  profile_visibility text,
  viewer_is_following boolean,
  can_view_details boolean,
  follower_count bigint,
  following_count bigint
)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  with access_state as (
    select
      coalesce(settings.profile_visibility, 'public') as visibility,
      exists (
        select 1
        from public.community_follows follows
        where follows.follower_id = (select auth.uid())
          and follows.following_id = target_user_id
      ) as is_following
    from (select 1) seed
    left join public.community_user_settings settings
      on settings.user_id = target_user_id
  )
  select
    access_state.visibility,
    access_state.is_following,
    access_state.visibility = 'public'
      or target_user_id = (select auth.uid())
      or access_state.is_following,
    (select count(*) from public.community_follows follows where follows.following_id = target_user_id),
    (select count(*) from public.community_follows follows where follows.follower_id = target_user_id)
  from access_state;
$$;

revoke all on function public.community_get_profile_access(uuid) from public, anon;
grant execute on function public.community_get_profile_access(uuid) to authenticated, service_role;

commit;
