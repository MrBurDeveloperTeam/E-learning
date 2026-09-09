create or replace function public.community_join_public(target_community_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  current_user_id uuid := (select auth.uid());
  existing_status text;
begin
  if current_user_id is null then
    raise exception 'Sign in to join this Community.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.communities c
    where c.id = target_community_id
      and c.visibility = 'public'
      and c.moderation_status = 'active'
  ) then
    raise exception 'This public Community invite is unavailable.' using errcode = 'P0002';
  end if;

  select m.membership_status into existing_status
  from public.community_members m
  where m.community_id = target_community_id
    and m.user_id = current_user_id;

  if existing_status = 'active' then
    return;
  elsif existing_status = 'banned' then
    raise exception 'You cannot rejoin this Community.' using errcode = '42501';
  elsif existing_status = 'left' then
    update public.community_members
    set membership_status = 'active', joined_at = now(), updated_at = now()
    where community_id = target_community_id and user_id = current_user_id;
    return;
  end if;

  insert into public.community_members (community_id, user_id, membership_status)
  values (target_community_id, current_user_id, 'active');
end;
$function$;

revoke all on function public.community_join_public(uuid) from public;
grant execute on function public.community_join_public(uuid) to authenticated;
