create or replace function public.community_request_join_by_slug(
  target_slug text,
  request_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  current_user_id uuid := (select auth.uid());
  target_community_id uuid;
  existing_request_id uuid;
  created_request_id uuid;
begin
  if current_user_id is null then
    raise exception 'Sign in to request access.' using errcode = '42501';
  end if;

  select c.id into target_community_id
  from public.communities c
  where c.slug = lower(btrim(target_slug))
    and c.visibility = 'private'
    and c.moderation_status = 'active'
    and c.owner_id <> current_user_id;

  if target_community_id is null then
    raise exception 'This private Community invite is unavailable.' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.community_members m
    where m.community_id = target_community_id
      and m.user_id = current_user_id
      and m.membership_status = 'active'
  ) then
    raise exception 'You are already a member of this Community.' using errcode = '23505';
  end if;

  select r.id into existing_request_id
  from public.community_join_requests r
  where r.community_id = target_community_id
    and r.requester_id = current_user_id
    and r.request_status = 'pending'
  order by r.created_at desc
  limit 1;

  if existing_request_id is not null then
    return existing_request_id;
  end if;

  insert into public.community_join_requests (
    community_id,
    requester_id,
    request_message,
    request_status
  ) values (
    target_community_id,
    current_user_id,
    nullif(btrim(request_message), ''),
    'pending'
  )
  returning id into created_request_id;

  return created_request_id;
end;
$function$;

revoke all on function public.community_request_join_by_slug(text, text) from public;
grant execute on function public.community_request_join_by_slug(text, text) to authenticated;
