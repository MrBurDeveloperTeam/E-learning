begin;

create or replace function community_private.follow_private_profile_after_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if new.friendship_status = 'accepted'
     and (tg_op = 'INSERT' or old.friendship_status is distinct from new.friendship_status) then
    insert into public.community_follows (follower_id, following_id)
    values (new.requester_id, new.addressee_id)
    on conflict (follower_id, following_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function community_private.follow_private_profile_after_approval() from public, anon, authenticated;

drop trigger if exists community_follow_after_friend_approval on public.community_friendships;
create trigger community_follow_after_friend_approval
after insert or update of friendship_status on public.community_friendships
for each row execute function community_private.follow_private_profile_after_approval();

create or replace function public.community_follow_or_request(target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_visibility text;
begin
  if current_user_id is null then
    raise exception 'Sign in to follow this member.' using errcode = '42501';
  end if;
  if current_user_id = target_user_id then
    raise exception 'You cannot follow your own profile.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where user_id = target_user_id) then
    raise exception 'This member could not be found.' using errcode = 'P0002';
  end if;

  select coalesce(settings.profile_visibility, 'public')
  into target_visibility
  from (select 1) seed
  left join public.community_user_settings settings on settings.user_id = target_user_id;

  if target_visibility = 'public' then
    insert into public.community_follows (follower_id, following_id)
    values (current_user_id, target_user_id)
    on conflict (follower_id, following_id) do nothing;
    return 'following';
  end if;

  if exists (
    select 1 from public.community_follows
    where follower_id = current_user_id and following_id = target_user_id
  ) then
    return 'following';
  end if;

  if exists (
    select 1 from public.community_friendships
    where requester_id = current_user_id
      and addressee_id = target_user_id
      and friendship_status = 'pending'
  ) then
    return 'request_pending';
  end if;

  delete from public.community_friendships
  where ((requester_id = current_user_id and addressee_id = target_user_id)
      or (requester_id = target_user_id and addressee_id = current_user_id))
    and friendship_status <> 'accepted';

  insert into public.community_friendships (requester_id, addressee_id, friendship_status)
  values (current_user_id, target_user_id, 'pending');
  return 'request_pending';
end;
$$;

revoke all on function public.community_follow_or_request(uuid) from public, anon;
grant execute on function public.community_follow_or_request(uuid) to authenticated, service_role;

drop function if exists public.community_get_profile_access(uuid);
create function public.community_get_profile_access(target_user_id uuid)
returns table (
  profile_visibility text,
  viewer_is_following boolean,
  viewer_request_pending boolean,
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
        select 1 from public.community_follows follows
        where follows.follower_id = (select auth.uid())
          and follows.following_id = target_user_id
      ) as is_following,
      exists (
        select 1 from public.community_friendships friendship
        where friendship.requester_id = (select auth.uid())
          and friendship.addressee_id = target_user_id
          and friendship.friendship_status = 'pending'
      ) as request_pending
    from (select 1) seed
    left join public.community_user_settings settings on settings.user_id = target_user_id
  )
  select
    access_state.visibility,
    access_state.is_following,
    access_state.request_pending,
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
